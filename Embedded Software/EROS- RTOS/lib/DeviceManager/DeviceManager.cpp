#include "DeviceManager.h"

DeviceManager::DeviceManager(){

    btEnabled = false; //na poczatek nikt nie klikal przycisku
    displayEnabled = false; //na poczatek wyswietlacz wylaczony
    btStarted = false; //na poczatek bluetooth nie jest jeszcze wystartowany

    btPressStart = 0;
    lcdPressStart = 0;

    SDcardEnabled = 0; //na początek nic nie ma i dopiero pozneij w inicie sprawdzam czy karta jest
    fileSystemEnabled = 0; //na poczatek nie ma systemu plikow bo nawet nie wiadomo czy jest karta

    EKGTestTime = 0; //na start czas badania ustawiany na zero jak cos bo pierwszy widok urzadzenia bedzie pozwalal ustawic ta wielkosc
    testTimeChosen = false;

}

void DeviceManager::init(){

    //SETUP MIKROKONTROLERA 

    Serial.begin(115200);

    //inicjalizacja wyswietlacza
    epd.LDirInit();
    epd.Clear();
    delay(100); //troche poczekamy az sie wyswietlacz zainicjalizuje cos tam pomryga i bomba (uzywam delay bo init bedzie przed startem RTOS)

    //inicjalizacja EKG 
    initHeartMonitor();

    //PINMODE PRZYCISKÓW
    pinMode(BTN_BT, INPUT_PULLUP);
    pinMode(BTN_LCD, INPUT_PULLUP);
    pinMode(BTN_MIN, INPUT_PULLUP);

}

void DeviceManager::setStartTime(){
    startTime = millis();
}

void DeviceManager::chooseTestTime(){
    if(testTimeChosen) return;
    uint8_t lastDisplayedTime=EKGTestTime;
    displayFirstScreen(EKGTestTime);
    displayFirstScreen(EKGTestTime);

    while(!testTimeChosen){
        checkTestTimeButtons();
        if(EKGTestTime!=lastDisplayedTime){
            updateTimeChoice(EKGTestTime);
            lastDisplayedTime=EKGTestTime;
        }
    }
    clearDisplay();
}

void DeviceManager::checkBluetooth(){

    if (btEnabled)
    {
        //inicjalizacja Bluetooth
        //czekamy jakis tam czas i sprawdzamy czy ktos sie polaczy do naszego holtera a jesli enabled juz jest wlaczony to nie wlaczaj
        if(!btStarted){
            SerialBT.begin("EROS");
            btStarted = true;
        }
        
        SerialBT.begin("EROS");

        for (int i = 0; i < 10; i++)
        {
            if(SerialBT.hasClient()) break; // jak ma klienta to od razu uciekam z petli bo po co
            vTaskDelay(pdMS_TO_TICKS(1000));
            //wychodzimy z petli jak znalazlo klienta
        }

        //sprawdzamy czy znalazlo klienta
        if(!SerialBT.hasClient()){
            SerialBT.end(); //wylaczamy BT
            btEnabled = false; //ustawiamy bt enabled na false bo nie ma klienta do wysylania danych i wychodzimy z funkcji zeby nie blokowac innych rzeczy w programie
            btStarted = false; //ustawiamy bt started na false zeby mozna bylo potem ponownie wlaczyc BT bez problemu
            return;
        }

        if (SerialBT.hasClient())
        {
            // czekamy na jakis komunikat od aplikacji zeby wyslac albo na bierzaco EKG albo plik z badaniem
            while (!SerialBT.available()) {
                vTaskDelay(pdMS_TO_TICKS(100));
            }

            String response = SerialBT.readStringUntil('\n');
            response.trim();
            if (response == "GET_ECG") {
            //wysylamy tutaj na bierzaco probki EKG do momentu uzyskania komunikatu STOP od aplikacji
                while (SerialBT.hasClient()) {
                    if (SerialBT.available()) {
                        String command = SerialBT.readStringUntil('\n');
                        command.trim();
                        if (command == "STOP") {
                            break;
                        }
                    }
                    SerialBT.print('E'); // 'E' to prefix oznaczajacy ze to jest probka EKG a nie jakis inny komunikat, potem idzie wartosc probki
                    SerialBT.println(getFilteredValue()); //tutaj wysylamy probke EKG 
                    vTaskDelay(pdMS_TO_TICKS(4)); //odstep czasowy miedzy probkami, zeby nie zalewac aplikacji danymi
                }

            //jak ESP zobaczy taka komende to wysyla plik z danym lub jego czesc
            } else if (response == "GET_FILE") {
                BTSendingFile();
            } else if(response == "GET_STATE") {
                BTSendingState();
            } else {
                //tutaj moze w przyszlosci obsluga w przypadku nieznanej komendy
                Serial.println("nieznana komenda: " + response);
            }
        }
    }
}

void DeviceManager::BTSendingFile(){
    if (SerialBT.hasClient()) {

        File file = SD.open("/test_ekg.csv"); // tutaj tworze sobie nowy uchwyt do pliku bo ten karoliny jest w prywatnych i nie da sie do niego odwolac
        if (!file) {
            //nie mozna otworzyc pliku
            return;
        }

        //Handshake do aplikacji czekajacy na potwierdzenie czy ta aplikacja jest gotowa na nasz plik
        SerialBT.println("READY");  // wysyłamy sygnał gotowości

        // czekamy na odpowiedź OK od aplikacji 
        while (!SerialBT.available()) {
            vTaskDelay(pdMS_TO_TICKS(100));
        }

        String response = SerialBT.readStringUntil('\n');
        response.trim();
        if (response != "OK") {
            Serial.println("Aplikacja nie jest gotowa na potezny plik!");
            file.close();
            return;
        }

        // Najpierw wysyłamy nagłowek pliku czyli jego nazwe oraz wielkosc tak zeby aplikacja wiedziala kiedy juz wszystko dostala 
        String header = String(file.name()) + ":" + String(file.size());
        SerialBT.println(header);
        Serial.println("Wysyłanie nagłówka: \n" + header);

        // wysyłanie danych w fajnych pakietach po 512
        const size_t bufferSize = 512;
        uint8_t buffer[bufferSize];
        size_t bytesRead;

        while ((bytesRead = file.read(buffer, bufferSize)) > 0) {
            SerialBT.write(buffer, bytesRead);
            vTaskDelay(pdMS_TO_TICKS(10)); // krótkie opóźnienie dla dzialania RTOS
        }

        file.close();

        // --- ZAKOŃCZENIE TRANSMISJI ---
        SerialBT.println("DONE");
        Serial.println("Plik wysłany!");
    }
}

void DeviceManager::BTSendingState()
{
    JsonDocument doc;

    doc["battery"] = getBatteryLevel();
    doc["signalQuality"] = "Stabilny";
    doc["isMeasuring"] = holter.isRecording();

    JsonArray electrodes = doc["electrodes"].to<JsonArray>();

    JsonObject e1 = electrodes.add<JsonObject>();
    e1["name"] = "RA (prawy)";
    e1["status"] = !isLeadOff();

    JsonObject e2 = electrodes.add<JsonObject>();
    e2["name"] = "LA (Lewy)";
    e2["status"] = !isLeadOff();

    JsonObject e3 = electrodes.add<JsonObject>();
    e3["name"] = "RL (brzuch)";
    e3["status"] = !isLeadOff();

    SerialBT.print('D');
    serializeJson(doc, SerialBT);
    SerialBT.println();
}

uint8_t DeviceManager::getBatteryLevel(){
    //tutaj kod do odczytu poziomu baterii i zwrocenia go w procentach
    return 75; //na razie zwracam jakas tam wartosc do testow
}

void DeviceManager::waitingForSDcard(){

    Serial.println("Initializing SD card.");

    do {

        SDcardEnabled = SD.begin();
        delay(100);
        fileSystemEnabled = holter.begin("/test_ekg.csv");
        delay(100);

        if (!SDcardEnabled) {
            Serial.println("ERROR: SD card does not work properly.");
            delay(1000);
            displayWarningPopUp("SD card not working");
            continue;
        }

        if (!fileSystemEnabled) {
            Serial.println("ERROR: File system problem writing to file.");
            delay(1000);
            displayWarningPopUp("Writing to file error");
            continue;
        }

        Serial.println("File opened, press middle button to stop. Writing data...");
        
        clearDisplay();
    }while(!SDcardEnabled || !fileSystemEnabled);
}

void DeviceManager::EKGReadingAndSending(){
            /* Kod do pomiarow na karte SD */
        if (digitalRead(BTN_MIN) == LOW || isTimeEnded()) {
            if (holter.isRecording()) {
                holter.closeFile();
                Serial.println(">>> STOP: Plik zapisany i zamkniety! <<<");
                displayEndScreen();
            }
        }
        processHeartRate();
        if (holter.isRecording()) {
            int16_t val = isLeadOff() ? 0 : (int16_t)getFilteredValue();
            holter.writeSample(val, getAverageBPM(), isLeadOff());

            // // Odkomentuj jak chcesz wyplotować wykres
            // Serial.print(">FiltredValue:");
            // Serial.println(getFilteredValue());
            // Serial.print(">IntegretedSignal:");
            // Serial.print(getIntegratedSignal()); 

            //to trzeba bedzie usunac w finalnej wersji
            static unsigned long lastTick = 0;
            if (millis() - lastTick > 1000) {
                
                
                lastTick = millis();
            }
        }
        vTaskDelay(pdMS_TO_TICKS(4));
}

uint8_t DeviceManager::calculateLeftHours()
{
    uint32_t elapsedHours = (millis() - startTime) / MS_PER_HOUR;
    return (elapsedHours >= EKGTestTime)
           ? 0
           : (EKGTestTime - elapsedHours);
}

uint8_t DeviceManager::calculateLeftMinutes()
{
    uint32_t elapsedTime = millis() - startTime;
    uint32_t totalTimeMs = EKGTestTime * MS_PER_HOUR;
    if (elapsedTime >= totalTimeMs)
        return 0;
    uint32_t remainingTimeMs = totalTimeMs - elapsedTime;
    return (remainingTimeMs % MS_PER_HOUR) / MS_PER_MINUTE;
}

bool DeviceManager::isTimeEnded()
{
    return (millis() - startTime) >= (EKGTestTime * MS_PER_HOUR);
}

void DeviceManager::updateDisplay(uint32_t timeInMs){

    if (displayEnabled){
        uint16_t refreshTime = 200; //jesli warunek spelniony to ustawiam sobie refresh time na wyswietlacz
        uint8_t BPM=getAverageBPM();
        wakeUpDisplay();
        displayMainScreen(BPM, calculateLeftHours(),calculateLeftMinutes(), EMPTY, btEnabled);
        displayMainScreen(BPM, calculateLeftHours(),calculateLeftMinutes(), EMPTY, btEnabled);

        for(int i = 0; i<=timeInMs/refreshTime; i++){ //licze sobie ile razy ma wykonac się petla odświeżania zeby czas wyświetlania był spełniony
            displayMainScreen(getAverageBPM(), calculateLeftHours(),calculateLeftMinutes(), EMPTY, btEnabled);  //to trzeba uzupelnic ladnie o czas trwania do konca badania ktory bedzie obliczny
            vTaskDelay(pdMS_TO_TICKS(refreshTime));
        }
        clearDisplay();
        displayEnabled = false;

    }else{
        vTaskDelay(pdMS_TO_TICKS(200)); //jesli wyswietlacz nie dziala to i tak sprawdzaj czy nie powinien co 200ms
    }
}


void DeviceManager::checkButtons()
{
    //Przycisk ktory wybudza bluetooth
    static bool btTriggered = false;
    if (digitalRead(BTN_BT) == LOW)
    {
        if (btPressStart == 0)
            btPressStart = millis();

        if (!btTriggered && millis() - btPressStart > 3000)
        {
            btEnabled = true;
            btTriggered = true;
            Serial.println("BT ENABLED");
        }
    }
    else
    {
        btPressStart = 0;
        btTriggered = false;
    }

    //Przycisk ktory odpowiada za wybudzanie wyswietlacza
    static bool lcdTriggered = false;
    if (digitalRead(BTN_LCD) == LOW)
    {
        if (lcdPressStart == 0)
            lcdPressStart = millis();

        if (!lcdTriggered && millis() - lcdPressStart > 2000)
        {
            displayEnabled = true;
            lcdTriggered = true;
            Serial.println("DISPLAY ENABLED");
        }
    }
    else
    {
        lcdPressStart = 0;
        lcdTriggered = false;
    }
}

void DeviceManager::checkTestTimeButtons()
{
    //Przycisk który zwieksza czas trwania testu
    static bool upTriggered = false;
    if (digitalRead(BTN_T_UP) == LOW)
    {
        if (upPressStart == 0)
            upPressStart = millis();

        if (!upTriggered && millis() - upPressStart > 100)
        {
            EKGTestTime++;
            Serial.println(EKGTestTime);
            upPressStart = 0;
            return;
        }
    }
    else
    {
        upPressStart = 0;
        upTriggered = false;
    }

    //Przycisk który zmniejsza czas trwania testu
    static bool downTriggered = false;
    if (digitalRead(BTN_T_DOWN) == LOW && EKGTestTime>0)
    {
        if (downPressStart == 0)
            downPressStart = millis();

        if (!downTriggered && millis() - downPressStart > 100)
        {
            EKGTestTime--;
            Serial.println(EKGTestTime);
            downPressStart = 0;
            return;
        }
    }
    else
    {
        downPressStart = 0;
        downTriggered = false;
    }

    //Przycisk który zatwierdza czas trwania testu
    static bool confirmTriggered = false;
    if(digitalRead(BTN_T_CONFIRM)==LOW){
        if (confirmPressStart == 0)
            confirmPressStart = millis();

        if (!downTriggered && millis() - confirmPressStart > 1000)
        {
            testTimeChosen=true;
            confirmPressStart = 0;
            return;
        }
    }
    else
    {
        confirmPressStart = 0;
        confirmTriggered = false;
    }
}

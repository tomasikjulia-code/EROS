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

    currentDisplayState = DISPLAY_OFF;

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

    //ustawienie atenuacji dla ADC zeby moc mierzyc do 3.6V co jest potrzebne do poprawnego zczytywania procentow
    analogSetAttenuation(ADC_11db); // Pozwala mierzyć do ok. 3.6V

}

void DeviceManager::setStartTime(){
    startTime = millis();
}

void DeviceManager::chooseTestTime(){
    currentDisplayState=DISPLAY_FIRST_SCREEN;
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
            Serial.println("Mam klienta");
            // czekamy na jakis komunikat od aplikacji zeby wyslac albo na bierzaco EKG albo plik z badaniem
            while (!SerialBT.available()) {
                vTaskDelay(pdMS_TO_TICKS(100));
            }

            String response = SerialBT.readStringUntil('\n');
            response.trim();

            Serial.println("Otrzymano komendę: " + response);

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

        uint32_t lastSampleReceived = 0; // Zmienna do przechowywania numeru ostatniej próbki, którą otrzymała aplikacja
        File file = SD.open("/test_ekg.csv"); // tutaj tworze sobie nowy uchwyt do pliku bo ten karoliny jest w prywatnych i nie da sie do niego odwolac
        if (!file) {
            //nie mozna otworzyc pliku
            return;
        }

        //Handshake do aplikacji czekajacy na potwierdzenie czy ta aplikacja jest gotowa na nasz plik
        Serial.println("BTSendingFile entered");
        SerialBT.println("READY");  // wysyłamy sygnał gotowości
        Serial.println("READY sent");

        // czekamy na odpowiedź OK od aplikacji
        unsigned long waitStart = millis();
        while (!SerialBT.available()) {
            if (millis() - waitStart > 10000) {  // 10 ssekund timeoutu, gdyby nie było odpowiedzi
                Serial.println("[BTSendingFile] Timeout waiting for OK, aborting");
                file.close();
                return;
            }
            vTaskDelay(pdMS_TO_TICKS(100));
        }

        String response = SerialBT.readStringUntil('\n');
        response.trim();

        Serial.println("Otrzymano odpowiedź: " + response);

        //sprawdzamy jaka ostatnia probke ma aplikacja zeby wiedziec od czego wysylac plik
        if(response.startsWith("OK")){
            lastSampleReceived=response.substring(2).toInt();
            Serial.println(lastSampleReceived);
        }
        else{
            Serial.println("[BTSendingFile] Unexpected response, aborting");
            file.close();
            return;
        }

        //szukanie miejsca w pliku od ktorego zaczyna sie wysylanie danch ktorych nie ma aplikacja 
        bool found = false;
        unsigned long lastPosition = 0;
        if(lastSampleReceived >= 0){
             //szukamy probki tylko jesli ta liczba ostatniej probki jest wieksza od zera
            while (file.available()) {
                lastPosition = file.position(); // Zapamiętaj początek aktualnej linii
                String line = file.readStringUntil('\n');
                
                if (line.length() > 0) {
                    // Wyciągamy pierwszą wartość (millis) do pierwszego przecinka
                    int commaIndex = line.indexOf(',');
                    if (commaIndex != -1) {
                        unsigned long currentMillis = line.substring(0, commaIndex).toInt();
                        
                        if (currentMillis == lastSampleReceived) {
                            //Ustawiamy kursor na początku TEJ linii jesli znalezlismy 
                            file.seek(lastPosition);
                            found = true;
                            break;
                        }
                    }
                }
            }
            if (!found) {
                //jesli nie znalezlismy to znaczy ze aplikacja cos wymysla i nie ma tej probki w pliku wiec wysylamy wszystko od poczatku
                file.seek(0);
            }
        }

        //tutaj kod na wysylanie printem

        // size_t fileEnd = file.size();

        // while(file.position() < fileEnd){
        //     SerialBT.print(file.readStringUntil('\n'));
        //     vTaskDelay(pdMS_TO_TICKS(2));
        // }

        //tutaj wysylanie zostawiam paczkami po 512 bajtow
        const size_t bufferSize = 512;
        uint8_t buffer[bufferSize];
        size_t bytesRead;

        size_t startPos = file.position();
        size_t fileSize = file.size();
        Serial.println(fileSize);
        size_t bytesToSend = fileSize - startPos;
        size_t totalRead = 0;

        while (totalRead < bytesToSend) {
            size_t remainingInFile = bytesToSend - totalRead;
            size_t toRead = std::min((size_t)bufferSize, remainingInFile);

            //tutaj jest pętla ktora odpowiada za oczekiwanie na to czy w buforze jest wystarczajaco duzo miejsca zeby wyslac kolejna paczke
            // while (SerialBT.availableForWrite() < toRead) {
            //     vTaskDelay(pdMS_TO_TICKS(1)); // Bardzo krótkie uśpienie, by nie blokować CPU
            // }
            bytesRead = file.read(buffer, toRead);
            if (bytesRead <= 0) break;

            size_t written = SerialBT.write(buffer, bytesRead); 
            totalRead += written;
            vTaskDelay(pdMS_TO_TICKS(5));

        }

        Serial.println("Wysyłanie zakończone. Zamykam plik.");

        file.close();

        // --- ZAKOŃCZENIE TRANSMISJI ---
        SerialBT.println("S");
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
    e1["ok"] = !isLeadOff();

    JsonObject e2 = electrodes.add<JsonObject>();
    e2["name"] = "LA (Lewy)";
    e2["ok"] = !isLeadOff();

    JsonObject e3 = electrodes.add<JsonObject>();
    e3["name"] = "RL (brzuch)";
    e3["ok"] = !isLeadOff();

    SerialBT.print('D');
    serializeJson(doc, SerialBT);
    SerialBT.println();
}

uint8_t DeviceManager::getBatteryLevel()
{
    int raw_mV = analogReadMilliVolts(BATTERY_LEVEL_PIN);

    float voltageADC = raw_mV / 1000.0;
    float batteryVoltage = voltageADC * 2.0;

    float percent =
        (batteryVoltage - 3.2) /
        (4.2 - 3.2) * 100.0;

    percent = constrain(percent, 0, 100);
    //Serial.printf("Battery Voltage: %d%%\n", (uint8_t)percent);

    return (uint8_t)percent;
}

battery_level DeviceManager::getBatteryIconLevel(uint8_t batteryLevel){
    if(batteryLevel > 80) return FULL;
    else if(batteryLevel > 60) return THREE_QUARTERS;
    else if(batteryLevel > 40) return HALF;
    else if(batteryLevel > 20) return QUARTER;
    else return EMPTY;
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
                displayEnabled=false;
                currentDisplayState=DISPLAY_END;
            }
        }
        processHeartRate();
        if (holter.isRecording()) {
            int16_t val = isLeadOff() ? 0 : (int16_t)getFilteredValue();
            holter.writeSample(val, getAverageBPM(), isLeadOff());

            // // Odkomentuj jak chcesz wyplotować wykres
            //Serial.print(">FiltredValue:");
            //Serial.println(getFilteredValue());
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
    uint32_t testDuration = (uint32_t)EKGTestTime * MS_PER_HOUR;
    return (millis() - startTime) >= testDuration;
}

void DeviceManager::updateDisplay(uint32_t timeInMs){
    if (currentDisplayState==DISPLAY_END){
        displayEndScreen();
    }
    else if (displayEnabled && !isTimeEnded()){
        uint16_t refreshTime = 200; //jesli warunek spelniony to ustawiam sobie refresh time na wyswietlacz
        
        uint8_t BPM=getAverageBPM();
        
        wakeUpDisplay();
        //displayMainScreen(BPM, calculateLeftHours(),calculateLeftMinutes(), getBatteryIconLevel(getBatteryLevel()), btEnabled);
        displayMainScreen(BPM, calculateLeftHours(),calculateLeftMinutes(), getBatteryIconLevel(getBatteryLevel()), btEnabled);

        for(int i = 0; i<=timeInMs/refreshTime; i++){ //licze sobie ile razy ma wykonac się petla odświeżania zeby czas wyświetlania był spełniony
            if(!displayEnabled){
                clearDisplay();
                return;
            }
            displayMainScreen(getAverageBPM(), calculateLeftHours(),calculateLeftMinutes(), getBatteryIconLevel(getBatteryLevel()), btEnabled);  //to trzeba uzupelnic ladnie o czas trwania do konca badania ktory bedzie obliczny
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

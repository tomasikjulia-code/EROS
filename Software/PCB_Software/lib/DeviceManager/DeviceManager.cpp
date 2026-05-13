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

    //inicjalizacja SPI od wyświetlacza i karty SD
    vspi.begin(18, 19, 23, -1);

    //inicjalizacja spi do EKG
    hspi.begin(12, 14, 13, 15);
    hspi.beginTransaction(SPISettings(1000000, MSBFIRST, SPI_MODE1));
    
    //inicjalizacja wyswietlacza
    epd.LDirInit();
    epd.Clear();
    delay(100);

    //inicjalizacja EKG 
    initHeartMonitor();

    //inicjalizacja akcelerometru
    if (!accel.begin()) {Serial.println("Błąd: Nie znaleziono akcelerometru!");}

    //PINMODE PRZYCISKÓW
    pinMode(BTN_LCD, INPUT_PULLUP);
    pinMode(BTN_EVENT, INPUT_PULLUP);

    
    pinMode(SD_CS_PIN, OUTPUT);
    digitalWrite(SD_CS_PIN, HIGH);
    pinMode(DISPLAY_CS_PIN, OUTPUT);
    digitalWrite(DISPLAY_CS_PIN, HIGH);

    analogReadResolution(12);
    analogSetPinAttenuation(36, ADC_11db);

    // Inicjalizacja podwójnego bufora
    currentBuffer = bufferA;
    readyToWriteBuffer = nullptr;
    bufferIndex = 0;

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
        delay(10);
    }
    clearDisplay();
}

void DeviceManager::checkBluetooth(SemaphoreHandle_t sdMutex){

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
            //wysylamy tutaj na biezaco probki EKG do momentu uzyskania komunikatu STOP od aplikacji
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
                    vTaskDelay(pdMS_TO_TICKS(8)); //odstep czasowy miedzy probkami, zeby nie zalewac aplikacji danymi
                }

            //jak ESP zobaczy taka komende to wysyla plik z danym lub jego czesc
            } else if (response == "GET_FILE") {
                BTSendingFile(sdMutex);
            } else if(response == "GET_STATE") {
                BTSendingState();
            } else {
                //tutaj moze w przyszlosci obsluga w przypadku nieznanej komendy
                Serial.println("nieznana komenda: " + response);
            }
        }
    }
}

void DeviceManager::BTSendingFile(SemaphoreHandle_t sdMutex) {
    if (!SerialBT.hasClient()) return;

    // Handshake bez muteksu
    SerialBT.println("READY");  
    Serial.println("[BT] Wysłano READY, czekam na OK...");

    unsigned long waitStart = millis();
    while (!SerialBT.available()) {
        if (millis() - waitStart > 10000) { // 10 sekund timeoutu
            Serial.println("[BT] Timeout: Aplikacja nie odpowiedziała.");
            return; 
        }
        vTaskDelay(pdMS_TO_TICKS(100)); // Dajemy czas innym zadaniom
    }

    String response = SerialBT.readStringUntil('\n');
    response.trim();

    uint32_t lastSampleReceived = 0;
    if (response.startsWith("OK")) {
        lastSampleReceived = response.substring(2).toInt();
        Serial.printf("[BT] Start od próbki: %d\n", lastSampleReceived);
    } else {
        Serial.println("[BT] Niepoprawna odpowiedź, przerywam.");
        return;
    }

    // dostep do kart SD przez muteks
    if (xSemaphoreTake(sdMutex, portMAX_DELAY)) {
        File file = SD.open("/test_ekg.csv");
        if (!file) {
            xSemaphoreGive(sdMutex);
            return;
        }

        //Szybkie przewijanie do odpowiedniej linii 
        uint32_t targetLine = lastSampleReceived / 4;
        uint32_t currentLine = 0;

        if (targetLine > 0) {
            Serial.printf("[BT] Przeskakuje do linii: %d\n", targetLine);

            while (file.available() && currentLine < targetLine) {
                if (file.read() == '\n') {
                    currentLine++;
                    
                    // Resetowanie licznika Watchdoga co 600 przeczytanych linii
                    //UWAGA JESLI PLIK BEDZIE DUZY TO TRZEBA ALBO ZWIEKSZYC TIMEOUT W APLIKACJI 
                    //ALBO TUTAJ ZWIEKSZYL LICZBE LINII PO KTOREJ JEST DELAY DLA PROCESORA
                    if (currentLine % 600 == 0) {

                        xSemaphoreGive(sdMutex); // Oddajemy muteks, żeby inne zadania mogły działać
                        vTaskDelay(pdMS_TO_TICKS(2)); 
                        xSemaphoreTake(sdMutex, portMAX_DELAY); // Bierzemy muteks z powrotem, żeby kontynuować wysyłanie
                    }
                }
            }
        }

        //Wysyłanie w porcjach 
        const size_t bufferSize = 512;
        uint8_t buffer[bufferSize];
        
        while (file.available() && SerialBT.hasClient()) {
            size_t bytesRead = file.read(buffer, bufferSize);
            
            SerialBT.write(buffer, bytesRead);

            xSemaphoreGive(sdMutex); // Oddajemy muteks, żeby inne zadania mogły działać
            vTaskDelay(pdMS_TO_TICKS(2)); 
            xSemaphoreTake(sdMutex, portMAX_DELAY); // Bierzemy muteks z powrotem, żeby kontynuować wysyłanie
        }

        file.close();
        xSemaphoreGive(sdMutex); // Oddajemy dostęp do karty SD
    }

    SerialBT.println("S"); // Koniec transmisji
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

uint8_t DeviceManager::getBatteryLevel(){

    int raw_mV = analogReadMilliVolts(BATTERY_LEVEL_PIN);

    Serial.printf("Battery Voltage: %d\n", raw_mV);

    float voltageADC = raw_mV / 1000.0;
    float batteryVoltage = voltageADC * 2.0;

    float percent =
        (batteryVoltage - 3.2) /
        (4.2 - 3.2) * 100.0;

    percent = constrain(percent, 0, 100);
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

        SDcardEnabled = SD.begin(SD_CS_PIN, vspi, 4000000);
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

void DeviceManager::collectAndBufferSample(TaskHandle_t sdTaskHandle) {
   
    uint32_t timeout = 2000; // Krótki bezpiecznik
    while (digitalRead(ADS1292_DRDY_PIN) == HIGH && timeout > 0) {
        timeout--;
        delayMicroseconds(1);
    }

    bool dataReady = processHeartRate(); 

    if (!dataReady) {
        return; 
    }

    //wypełniam sobie bufor nowymi danym na giga chillu
    currentBuffer[bufferIndex].timestamp = millis() - startTime; //czas od rozpoczecia badania
    currentBuffer[bufferIndex].rawValue = isLeadOff() ? 0 : (int32_t)getFilteredValue();
    currentBuffer[bufferIndex].bpm = getAverageBPM();
    currentBuffer[bufferIndex].leadOff = isLeadOff();
    
    // Obsługa aktywności (zapisz tylko jeśli nowa, inaczej -1)
    if (newActivityReady) {
        currentBuffer[bufferIndex].activity = lastActivityValue;
        newActivityReady = false;
    } else {
        currentBuffer[bufferIndex].activity = -1.0f; 
    }
    
    // Obsługa przycisku mowiacego o naglych sytuacjach
    currentBuffer[bufferIndex].important = importantButton;
    importantButton = 0;

    bufferIndex++;

    // jesli bufor sie zapelnil zamien i wyslij powiadomienie
    if (bufferIndex >= EKG_BUFFER_SIZE) {
        readyToWriteBuffer = currentBuffer; // Przekaż pełny bufor do zapisu
        
        // Zamień wskaźniki ze starego bufora na nowy pusty
        if (currentBuffer == bufferA) currentBuffer = bufferB;
        else currentBuffer = bufferA;
        
        bufferIndex = 0;

        // Wyślij sygnał (Notyfikację) do taska zapisującego na SD
        if (sdTaskHandle != nullptr) {
            xTaskNotifyGive(sdTaskHandle);
        }
    }
}

void DeviceManager::writeBufferToSD() {
    // Sprawdź, czy czas badania się skończył
    if (isTimeEnded() && holter.isRecording()) {
        holter.closeFile();
        Serial.println(">>> STOP: Plik zapisany i zamkniety! <<<");
        displayEnabled = false;
        currentDisplayState = DISPLAY_END;
        vTaskDelay(pdMS_TO_TICKS(200));
        return; 
    }

    // Zapisz gotowy bufor na kartę SD
    if (readyToWriteBuffer != nullptr && holter.isRecording()) {
        holter.writeBuffer(readyToWriteBuffer, EKG_BUFFER_SIZE);
        readyToWriteBuffer = nullptr; //zeruje po zapisaniu zeby na pewno byl pusty
    }
}


//--------------------------UWAGA TO FUNKCJA DO ZAPISU LINIA PO LINII NA KARCIE SD------------------------------
void DeviceManager::EKGReadingAndSending(){
        if (isTimeEnded()) {
            if (holter.isRecording()) {
                holter.closeFile();
                Serial.println(">>> STOP: Plik zapisany i zamkniety! <<<");
                displayEnabled=false;
                clearDisplay();
                currentDisplayState=DISPLAY_END;
            }
        }
        processHeartRate();
        if (holter.isRecording()) {
            int16_t val = isLeadOff() ? 0 : (int16_t)getFilteredValue();
            
            float activityToSave = -1;
            if (newActivityReady) {
                activityToSave = lastActivityValue;
                newActivityReady = false; 
            }
            
            int buttonStatus = importantButton;
            importantButton = 0;

            holter.writeSample(millis()- startTime, val, getAverageBPM(), isLeadOff(), activityToSave, buttonStatus);

            static unsigned long lastTick = 0;
            if (millis() - lastTick > 1000) {
                
                
                lastTick = millis();
            }
        }
        vTaskDelay(pdMS_TO_TICKS(4));
}
//------------------------KONIEC NIEUZYWANEJ FUNKCJI DO ZAPISU LINIA PO LINII NA KARCIE SD------------------------------


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

void DeviceManager::updateDisplay(uint32_t timeInMs, SemaphoreHandle_t sdMutex){
    if (currentDisplayState==DISPLAY_END){
        //czekam na semafor od karty sd zeby moc uzyc wyswietlacza
        xSemaphoreTake(sdMutex, portMAX_DELAY);
        displayEndScreen();
        xSemaphoreGive(sdMutex);

    }
    else if (displayEnabled && !isTimeEnded()){
        uint16_t refreshTime = 200; //jesli warunek spelniony to ustawiam sobie refresh time na wyswietlacz
        
        uint8_t BPM=getAverageBPM();
        
        xSemaphoreTake(sdMutex, portMAX_DELAY);

        wakeUpDisplay();
        displayMainScreen(BPM, calculateLeftHours(),calculateLeftMinutes(), getBatteryIconLevel(getBatteryLevel()), btEnabled);

        xSemaphoreGive(sdMutex);

        for(int i = 0; i<=timeInMs/refreshTime; i++){ //licze sobie ile razy ma wykonac się petla odświeżania zeby czas wyświetlania był spełniony
            //odswierzam wyswietlacz tylko wtedy jak karta sd nie uzywa SPI 
            xSemaphoreTake(sdMutex, portMAX_DELAY);

            if(!displayEnabled){
                clearDisplay();
                return;
            }
            displayMainScreen(getAverageBPM(), calculateLeftHours(),calculateLeftMinutes(), getBatteryIconLevel(getBatteryLevel()), btEnabled);  //to trzeba uzupelnic ladnie o czas trwania do konca badania ktory bedzie obliczny
            
            xSemaphoreGive(sdMutex);

            vTaskDelay(pdMS_TO_TICKS(refreshTime));
        }
        
        //tutaj przed czyszczeniem tez czekam na semafor od karty
        xSemaphoreTake(sdMutex, portMAX_DELAY);
        clearDisplay();
        xSemaphoreGive(sdMutex);

        displayEnabled = false;

    }else{
        vTaskDelay(pdMS_TO_TICKS(200)); //jesli wyswietlacz nie dziala to i tak sprawdzaj czy nie powinien co 200ms
    }
}


void DeviceManager::checkButtons()
{
    bool btnLcd = (digitalRead(BTN_LCD) == LOW);
    bool btnEvent = (digitalRead(BTN_EVENT) == LOW);

    static bool btTriggered = false;
    static bool lcdTriggered = false;
    static bool eventTriggered = false;

    //Bluetooth
    if (btnLcd && btnEvent)
    {
        lcdTriggered = true; 
        eventTriggered = true;
        lcdPressStart = 0;

        if (btPressStart == 0) btPressStart = millis();

        if (!btTriggered && (millis() - btPressStart > 3000))
        {
            btEnabled = true;
            btTriggered = true;
            Serial.println(">>> BLUETOOTH WŁĄCZONY <<<");
        }
        return; 
    }
    else
    {
        btPressStart = 0;
        btTriggered = false;
    }

    //Wyświetlacz
    if (btnLcd && !btnEvent) 
    {
        if (lcdPressStart == 0) lcdPressStart = millis();

        if (!lcdTriggered && (millis() - lcdPressStart > 2000))
        {
            displayEnabled = true;
            lcdTriggered = true;
            Serial.println(">>> WYŚWIETLACZ WYBUDZONY <<<");
        }
    }
    else if (!btnLcd)
    {
        lcdPressStart = 0;
        lcdTriggered = false;
    }

    //Ważne zdarzenie 
    if (btnEvent && !btnLcd) 
    {
        if (!eventTriggered)
        {
            importantButton = 1;
            eventTriggered = true;
            Serial.println(">>> ZDARZENIE OZNACZONE <<<");
        }
    }
    else if (!btnEvent)
    {
        eventTriggered = false;
    }

}

void DeviceManager::checkTestTimeButtons()
{
    bool btnUp = (digitalRead(BTN_T_UP) == LOW);
    bool btnDown = (digitalRead(BTN_T_DOWN) == LOW);

    static bool upTriggered = false;
    static bool downTriggered = false;

    // LOGIKA ZATWIERDZANIA 
    if (btnUp && btnDown)
    {
        upTriggered = true; 
        downTriggered = true;
        upPressStart = 0;
        downPressStart = 0;

        if (confirmPressStart == 0) confirmPressStart = millis();

        if (millis() - confirmPressStart > 1000) 
        {
            testTimeChosen = true;
            Serial.println(">>> CZAS ZATWIERDZONY <<<");
            confirmPressStart = 0;
        }
        return; 
    }
    else
    {
        confirmPressStart = 0;
    }

    //PRZYCISK GÓRA
    if (btnUp && !btnDown)
    {
        if (upPressStart == 0) upPressStart = millis();
        if (!upTriggered && (millis() - upPressStart > 150)) 
        {
            EKGTestTime++;
            upTriggered = true;
            Serial.printf("Zwiększono: %d h\n", EKGTestTime);
        }
    }
    else if (!btnUp) 
    {
        upPressStart = 0;
        upTriggered = false;
    }

    //PRZYCISK DÓŁ
    if (btnDown && !btnUp)
    {
        if (downPressStart == 0) downPressStart = millis();
        if (!downTriggered && (millis() - downPressStart > 150))
        {
            downTriggered = true;
            if (EKGTestTime > 0) 
            {
                EKGTestTime--;
                Serial.printf("Zmniejszono: %d h\n", EKGTestTime);
            }            
        }
    }
    else if (!btnDown)
    {
        downPressStart = 0;
        downTriggered = false;
    }
}

void DeviceManager::processAccelerometer() {

    if (millis() - lastAccelCheck >= 10000UL) {
        float sum = 0;
        int samplesCount = 15;

        for (int i = 0; i < samplesCount; i++) {
            sum += accel.getInstantActivity();
            vTaskDelay(pdMS_TO_TICKS(20)); 
        }

        float currentMeasure = sum / (float)samplesCount;

        if (accel.getAverageActivity() == 0) accel.averageActivity = currentMeasure; 
        else accel.averageActivity = (accel.averageActivity * 0.6f) + (currentMeasure * 0.4f);

        lastActivityValue = accel.averageActivity;
        newActivityReady = true; 

        Serial.printf("Zaktualizowano średnią aktywność: %.2f\n", accel.averageActivity);
        lastAccelCheck = millis();
    }
}
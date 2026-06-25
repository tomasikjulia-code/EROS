#include "DeviceManager.h"
#include <esp_task_wdt.h>

//Definicje zmiennych statycznych (obiektów)
BluetoothSerial DeviceManager::SerialBT;
CsvWriter DeviceManager::holter;
MyAccelerometer DeviceManager::accel;

//Definicje statycznych tablic
Sample DeviceManager::bufferA[EKG_BUFFER_SIZE];
Sample DeviceManager::bufferB[EKG_BUFFER_SIZE];
String DeviceManager::response = "";

DeviceManager::DeviceManager(){

    btEnabled = false; //na poczatek nikt nie klikal przycisku
    displayEnabled = false; //na poczatek wyswietlacz wylaczony
    btStarted = false; //na poczatek bluetooth nie jest jeszcze wystartowany

    btPressStart = 0;
    lcdPressStart = 0;
    eventPressStart = 0;

    SDcardEnabled = 0; //na początek nic nie ma i dopiero pozneij w inicie sprawdzam czy karta jest
    fileSystemEnabled = 0; //na poczatek nie ma systemu plikow bo nawet nie wiadomo czy jest karta

    response.reserve(50);

    EKGTestTime = 1; //na start czas badania ustawiany na jedynkę jak cos bo pierwszy widok urzadzenia bedzie pozwalal ustawic ta wielkosc
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

    BuzzerManager.begin(); 
}

void DeviceManager::setStartTime(){
    startTime = millis();
}

void DeviceManager::chooseTestTime(){

    currentDisplayState = DISPLAY_FIRST_SCREEN;
    if(testTimeChosen) return;
    
    uint8_t lastDisplayedTime = EKGTestTime;
    displayFirstScreen(EKGTestTime);
    displayFirstScreen(EKGTestTime);

    unsigned long lastTimeChangeMillis = 0; 
    // bool needsDisplayUpdate = false;        

    while(!testTimeChosen){
        checkTestTimeButtons();
        
        if(EKGTestTime != lastDisplayedTime){
            lastTimeChangeMillis = millis(); 
            updateTimeChoice(EKGTestTime);  
            lastDisplayedTime = EKGTestTime;
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
            esp_bt_mem_release(ESP_BT_MODE_BLE); //zwalnianie pamieci zarezerowanej na BLE

            SerialBT.begin("RYTHMIO");
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

            response = SerialBT.readStringUntil('\n');
            response.trim();

            Serial.println("Otrzymano komendę: " + response);

            if (response == "GET_ECG") {
            //wysylamy tutaj na biezaco probki EKG do momentu uzyskania komunikatu STOP od aplikacji
                uint8_t counter = 0;
                while (SerialBT.hasClient()) {
                    static char stopBuffer[5];
                    static int stopIdx = 0;

                    if (SerialBT.available()) {
                        char c = SerialBT.read();
                        if (c != '\n' && c != '\r' && stopIdx < 4) {
                            stopBuffer[stopIdx++] = c;
                        } else {
                            stopBuffer[stopIdx] = '\0';
                            if (strcmp(stopBuffer, "STOP") == 0) {
                                stopIdx = 0;
                                break; 
                            }
                            stopIdx = 0; 
                        }
                    }
                    SerialBT.print('E'); // 'E' to prefix oznaczajacy ze to jest probka EKG a nie jakis inny komunikat, potem idzie wartosc probki
                    SerialBT.println(getFilteredValue()); //tutaj wysylamy probke EKG 
                    vTaskDelay(pdMS_TO_TICKS(8)); //odstep czasowy miedzy probkami, zeby nie zalewac aplikacji danymi
                    if(counter == 25){
                        SerialBT.print('B');
                        SerialBT.println(getAverageBPM()); //wysylamy tez BPM co jakis czas zeby aplikacja mogla wyswietlic aktualny BPM
                        counter = 0;
                    }
                    counter++;
                }

            //jak ESP zobaczy taka komende to wysyla plik z danym lub jego czesc
            } else if (response == "GET_FILE") {
                BTSendingFile(sdMutex);
            } else if(response == "GET_STATE") {
                BTSendingState();
            } else if(response == "REMOVE_FILE") {

                if (xSemaphoreTake(sdMutex, portMAX_DELAY)) {
                    holter.begin("/test_ekg.csv");
                    setStartTime();
                    xSemaphoreGive(sdMutex);
                }
            }else{
                //tutaj moze w przyszlosci obsluga w przypadku nieznanej komendy
                Serial.println("nieznana komenda: " + response);
            }
        }
    }
}

void DeviceManager::BTSendingFile(SemaphoreHandle_t sdMutex) {
    response.clear(); // czyscimy stringa statycznego z odpowiedzią zeby kolejna mogla nadejsc

    if (!SerialBT.hasClient()) return;

    uint32_t fileSize = 0;
    // Handshake bez muteksu wysylamy rozmiar pliku razem z READY do wizualizacja paska ladowania w aplikacji mobilnej
    if (xSemaphoreTake(sdMutex, portMAX_DELAY)) {
        fileSize = holter.getFileSize();
        xSemaphoreGive(sdMutex);
    }

    SerialBT.print("READY ");
    SerialBT.println(fileSize);

    Serial.printf("[BT] Wysłano READY %lu, czekam na OK...\n", fileSize);

    unsigned long waitStart = millis();
    while (!SerialBT.available()) {
        if (millis() - waitStart > 10000) { // 10 sekund timeoutu
            Serial.println("[BT] Timeout: Aplikacja nie odpowiedziała.");
            return; 
        }
        vTaskDelay(pdMS_TO_TICKS(100)); // Dajemy czas innym zadaniom
    }

    response = SerialBT.readStringUntil('\n');
    response.trim();

    // szukamy komunikatu OK oraz pobieramy z niego dlugosc pliku jakim aktualnie dysponuje aplikacja
    int32_t fileSizeReceived = 0;

    if (response.startsWith("OK ")) { // Sprawdzamy czy zaczyna się od "OK "
        // Szukamy pozycji ostatniej spacji, która oddziela timestamp od rozmiaru
        int lastSpaceIndex = response.lastIndexOf(' ');

        if (lastSpaceIndex != -1) {
            // Wycinamy tekst od znaku po spacji do samego końca
            String sizeStr = response.substring(lastSpaceIndex + 1);
            fileSizeReceived = sizeStr.toInt(); // Konwersja na liczbę

            if(fileSizeReceived > fileSize){
                Serial.println("Plik w aplikacji ma większy rozmiar!\n");
                SerialBT.println("SIZE");
                return;
            }

            Serial.printf("[BT] Odebrany rozmiar pliku z aplikacji: %lu bajtów\n", fileSizeReceived);
        } else {
            Serial.println("[BT] Błąd formatu wiadomości (brak drugiej spacji).");
            return;
        }

        // dostep do kart SD przez muteks
        if (xSemaphoreTake(sdMutex, portMAX_DELAY)) {
            
            _fileToSend = SD.open("/test_ekg.csv");
            if (!_fileToSend) {
                xSemaphoreGive(sdMutex);
                SerialBT.println("S"); // Koniec transmisji
                return;
            }

            // przed wyslaniem danych robimy gigantyczny skok o wartosc podana przez aplikacje
            _fileToSend.seek(fileSizeReceived); 

            // Obliczamy ile bajtów docelowo zostało do wysłania z tego konkretnego "żądania"
            uint32_t bytesRemaining = fileSize - fileSizeReceived;


            // Wysyłanie w porcjach 
            static const size_t bufferSize = 4096; // 4 KB
            static uint8_t buffer[bufferSize];

            // Pętla wykonuje się dopóki mamy coś do wysłania (bytesRemaining > 0)
            while (bytesRemaining > 0 && _fileToSend.available() && SerialBT.hasClient()) {

                while (esp_get_free_heap_size() < 10000) { 
                    Serial.printf("[BT] Krytycznie mało RAMu (%lu), wstrzymuję odczyt z SD...\n", esp_get_free_heap_size());
                    xSemaphoreGive(sdMutex);
                    vTaskDelay(pdMS_TO_TICKS(50)); 
                    xSemaphoreTake(sdMutex, portMAX_DELAY);
                }
                
                // Zabezpieczamy odczyt z pliku na wypadek, gdyby do końca zostało mniej niż `bufferSize`
                size_t chunkToRead = (bytesRemaining < bufferSize) ? bytesRemaining : bufferSize;
                size_t bytesRead = _fileToSend.read(buffer, chunkToRead);
                
                if (bytesRead == 0) {
                    break; // Awaryjne wyjście w przypadku błędów na karcie SD
                }

                esp_task_wdt_reset();

                size_t written = 0;
                while (written < bytesRead && SerialBT.hasClient()) {
                    size_t ret = SerialBT.write(buffer + written, bytesRead - written);
                    if (ret > 0) written += ret;
                    esp_task_wdt_reset();
                    vTaskDelay(pdMS_TO_TICKS(1));
                }

                bytesRemaining -= bytesRead;

                xSemaphoreGive(sdMutex);
                vTaskDelay(pdMS_TO_TICKS(10)); 
                xSemaphoreTake(sdMutex, portMAX_DELAY);
            }
            SerialBT.println("S"); // Koniec transmisji wysyłany jak najszybciej po skończeniu porcji
            _fileToSend.close();
            xSemaphoreGive(sdMutex); // Oddajemy dostęp do karty SD
        }
    } else {
        Serial.println("[BT] Otrzymano niepoprawną odpowiedź (nie zaczyna się od OK).");
    }
}

void DeviceManager::BTSendingState()
{
    // Tablica znaków na stosie (256 bajtów spokojnie pomieści ten ciąg)
    char buffer[256];
    
    // Pobieramy stan elektrod (wywołujemy funkcję tylko raz dla optymalizacji)
    bool isOk = !isLeadOff();

    // Formatowanie tekstu prosto do bufora w formie zgodnej z JSON
    snprintf(buffer, sizeof(buffer), 
             "D{\"battery\":%d,\"signalQuality\":\"Stabilny\",\"isMeasuring\":%s,\"electrodes\":[{\"name\":\"RA (prawy)\",\"ok\":%s},{\"name\":\"LA (Lewy)\",\"ok\":%s},{\"name\":\"RL (brzuch)\",\"ok\":%s}]}",
             getBatteryLevel(),
             holter.isRecording() ? "true" : "false",
             isOk ? "true" : "false",
             isOk ? "true" : "false",
             isOk ? "true" : "false");

    // Wysyłamy gotowy ciąg znaków z \n na końcu (println)
    SerialBT.println(buffer);
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

    SDcardEnabled = SD.begin(SD_CS_PIN, vspi, 20000000);
    delay(100);
    fileSystemEnabled = holter.begin("/test_ekg.csv");
    delay(100);
    while(!SDcardEnabled || !fileSystemEnabled){

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
    }

}

void DeviceManager::collectAndBufferSample(TaskHandle_t sdTaskHandle) {

    buzzerSampleCounter++;
    
    if (buzzerSampleCounter >= 125) {
        buzzerSampleCounter = 0; 

        if (isLeadOff() && !isTimeEnded()) { 

            if (!alarmTriggered || (millis() - lastAlarmTime >= 5000UL)) {
                //Serial.println("[ALARM] Elektrody odpięte! Krótkie przypomnienie.");
                
                BuzzerManager.setVolume(15);      
                BuzzerManager.playContinuous();   
                vTaskDelay(pdMS_TO_TICKS(125));      
                BuzzerManager.stop();             

                lastAlarmTime = millis();         
                alarmTriggered = true;            
            }
        } else {

            if (alarmTriggered) {
                //Serial.println("[ALARM] Elektrody podłączone ponownie. Reset blokady.");
                alarmTriggered = false; 
            }
        }
    }
    uint32_t timeout = 2000; 
    while (digitalRead(ADS1292_DRDY_PIN) == HIGH && timeout > 0) {
        timeout--;
        delayMicroseconds(1);
    }
    if(isTimeEnded()) return; //jesli czas badania skonczony to juz nie idz dalej 

    bool dataReady = processHeartRate(); 

    if (!dataReady) {
        return; 
    }

    //wypełniam sobie bufor nowymi danym 
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

void DeviceManager::writeBufferToSD(SemaphoreHandle_t sdMutex) {
    // Sprawdź, czy czas badania się skończył
    if (isTimeEnded() && holter.isRecording()) {
        if (xSemaphoreTake(sdMutex, portMAX_DELAY) == pdTRUE) {
            holter.closeFile();
        xSemaphoreGive(sdMutex);
        }
        Serial.println(">>> STOP: Plik zapisany i zamkniety! <<<");
        displayEnabled = false;
        currentDisplayState = DISPLAY_END;
        if (xSemaphoreTake(sdMutex, portMAX_DELAY) == pdTRUE) {
            wakeUpDisplay();
            displayEndScreen();
        xSemaphoreGive(sdMutex);
        }
        while (true) {
            checkButtons();
            vTaskDelay(pdMS_TO_TICKS(500)); // Zatrzymaj dalsze operacje, ale pozwól innym zadaniom działać
        }
        return; 
    }

    // Zapisz gotowy bufor na kartę SD
    if (readyToWriteBuffer != nullptr && holter.isRecording()) {
        holter.writeBuffer(readyToWriteBuffer, EKG_BUFFER_SIZE, sdMutex);
        readyToWriteBuffer = nullptr; //zeruje po zapisaniu zeby na pewno byl pusty
    }
}


uint8_t DeviceManager::calculateLeftHours()
{
    uint32_t elapsedHours = (millis() - startTime) / MS_PER_HOUR;
    return (elapsedHours >= EKGTestTime)
           ? 0
           : (EKGTestTime - elapsedHours - 1);
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

        static bool hasEndBeeped = false;

        if (!hasEndBeeped) {

            for (int i = 0; i < 3; i++) {
                BuzzerManager.setVolume(15);
                BuzzerManager.playContinuous();
                vTaskDelay(pdMS_TO_TICKS(200)); 
                BuzzerManager.stop();
                vTaskDelay(pdMS_TO_TICKS(150)); 
            }
            hasEndBeeped = true; 
        }

        vTaskDelay(pdMS_TO_TICKS(500));
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
        if (eventPressStart == 0) eventPressStart = millis();

        if (!eventTriggered&& (millis() - eventPressStart > 1000))
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

/*
Przycisk górny zwiększa czas trwania badania. Jego przytrzymanie inkrementuje co sekundę o 1. 
Przycisk dolny działa tak samo tylko dekrementuje. 
Wciśnięcie przycisków w tym samym momencie zatwierdza czas trwania badania.
*/
void DeviceManager::checkTestTimeButtons()
{
    bool btnUp = (digitalRead(BTN_T_UP) == LOW);
    bool btnDown = (digitalRead(BTN_T_DOWN) == LOW);

    static bool upTriggered = false;
    static bool downTriggered = false;
    
    static int holdCounter = 0;

    const unsigned long DEBOUNCE_DELAY = 150;    

    // LOGIKA ZATWIERDZANIA 
    if (btnUp && btnDown)
    {
        upTriggered = true; 
        downTriggered = true;
        upPressStart = 0;
        downPressStart = 0;
        holdCounter = 0;

        if (confirmPressStart == 0) confirmPressStart = millis();

        if (millis() - confirmPressStart > 1000) 
        {
            testTimeChosen = true;
            Serial.println(">>> CZAS ZATWIERDZONY <<<");

            BuzzerManager.setVolume(15);        
            BuzzerManager.playContinuous();   
            delay(150);                        
            BuzzerManager.stop();               

            confirmPressStart = 0;
        }
        return; 
    }
    else
    {
        confirmPressStart = 0;
    }

    unsigned long currentRepeatRate = 1000; 


    // PRZYCISK GÓRA
    if (btnUp && !btnDown)
    {
        if (upPressStart == 0) {
            upPressStart = millis();
        }
        if (!upTriggered && (millis() - upPressStart > DEBOUNCE_DELAY)) 
        {
            EKGTestTime++;
            upTriggered = true;
            upPressStart = millis(); 
            holdCounter = 1;
            Serial.printf("Zwiększono: %d h\n", EKGTestTime);
        }
        else if (upTriggered && (millis() - upPressStart > currentRepeatRate))
        {
            if(holdCounter>=5){
                EKGTestTime++;
            }
            EKGTestTime++;
            upPressStart = millis(); 
            holdCounter++; 
            Serial.printf("Zwiększono: %d h \n", EKGTestTime);
        }
    }
    else 
    {
        upPressStart = 0;
        upTriggered = false;
    }

    // PRZYCISK DÓŁ
    if (btnDown && !btnUp)
    {
        if (downPressStart == 0) {
            downPressStart = millis();
        }

        if (!downTriggered && (millis() - downPressStart > DEBOUNCE_DELAY))
        {
            downTriggered = true;
            downPressStart = millis(); 
            holdCounter = 1;
            if (EKGTestTime > 0) 
            {
                EKGTestTime--;
                Serial.printf("Zmniejszono: %d h\n", EKGTestTime);
            }            
        }
        else if (downTriggered && (millis() - downPressStart > currentRepeatRate))
        {
            downPressStart = millis(); 
            holdCounter++; 
            if (EKGTestTime > 0) 
            {
                if(holdCounter>=5)  EKGTestTime--;
                if(EKGTestTime > 0) EKGTestTime--;
                Serial.printf("Zmniejszono: %d h \n", EKGTestTime);
            }
        }
    }
    else 
    {
        downPressStart = 0;
        downTriggered = false;
    }

    if (!btnUp && !btnDown)
    {
        holdCounter = 0;
    }
}

/*
 * Okresowo mierzy i wygładza poziom aktywności fizycznej pacjenta.
 * Funkcja uruchamia się co 5 sekund. Pobiera serię 15 szybkich pomiarów z akcelerometru
 * (w odstępach 20 ms), uśrednia je, a następnie przepuszcza przez filtr wygładzający (EMA),
 * aby zapobiec nagłym skokom na wykresie. Na koniec wystawia gotową wartość 
 * do zapisu w najbliższym buforze danych na karcie SD.
 */

void DeviceManager::processAccelerometer() {

    if (millis() - lastAccelCheck >= 5000UL) {
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

        //Serial.printf("Zaktualizowano średnią aktywność: %.2f\n", accel.averageActivity);
        lastAccelCheck = millis();
    }
}
#include "DeviceManager.h"

DeviceManager::DeviceManager(){

    btEnabled = false; //na poczatek nie dziala bluetooth
    displayEnabled = false; //na poczatek wyswietlacz wylaczony

    btPressStart = 0;
    lcdPressStart = 0;

    SDcardEnabled = 0; //na początek nic nie ma i dopiero pozneij w inicie sprawdzam czy karta jest
    fileSystemEnabled = 0; //na poczatek nie ma systemu plikow bo nawet nie wiadomo czy jest karta

    EKGegzamineTime = 0; //na start czas badania ustawiany na zero jak cos bo pierwszy widok urzadzenia bedzie pozwalal ustawic ta wielkosc


}

void DeviceManager::init(){

    //SETUP MIKROKONTROLERA 

    Serial.begin(115200);

    //inicjalizacja Bluetooth
    SerialBT.begin("HolterEkg");
    delay(1000); //troche poczekamy bo czemu nie bo to inicjalizacja przeciez

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

void DeviceManager::checkBluetooth(){

    if (btEnabled && SerialBT.hasClient())
    {
        //fajnie by było jakby tutaj była jakas informacja ze po nacisnieciu przycisku zaczyna sie przesyl bluetooth 

        File file = SD.open("/test_ekg.csv"); // tutaj tworze sobie nowy uchwyt do pliku bo ten karoliny jest w prywatnych i nie da sie do niego odwolac
        if (!file) {
            Serial.println("Nie można otworzyć pliku!");
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
        btEnabled = false; //to robimy na false bo chcemy tylko wysylac jak przycisk byl nacisniety
    }
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
            //tutaj fajnie by było dać wyświetlanie na ekranie ze nie ma karty
            continue;
        }

        if (!fileSystemEnabled) {
            Serial.println("ERROR: File system problem writing to file.");
            delay(1000);
            //tutaj fajnie by było dać info ze blad systemu plikow na wyswietlaczu
            continue;
        }

        Serial.println("File opened, press middle button to stop. Writing data...");

    }while(!SDcardEnabled || !fileSystemEnabled);
}

void DeviceManager::EKGReadingAndSending(){
            /* Kod do pomiarow na karte SD */
        if (digitalRead(BTN_MIN) == LOW) { //tutaj trzba dodac ze holter ma skonczyc pomiar w chwili kiedy czas dobiegnie końca (zamiast środkowego przycisku)
            if (holter.isRecording()) {
                holter.closeFile();
                Serial.println(">>> STOP: Plik zapisany i zamkniety! <<<");
            }
        }
        processHeartRate();
        if (holter.isRecording()) {
            int16_t val = isLeadOff() ? 0 : (int16_t)getFilteredValue();
            holter.writeSample(val, getAverageBPM(), isLeadOff());
            
            //to trzeba bedzie usunac w finalnej wersji
            static unsigned long lastTick = 0;
            if (millis() - lastTick > 1000) {
                Serial.print(".");
                lastTick = millis();
            }
        }
        vTaskDelay(pdMS_TO_TICKS(4));
}


void DeviceManager::updateDisplay(uint32_t timeInMs){


    if (displayEnabled){

        uint16_t refreshTime = 200; //jesli warunek spelniony to ustawiam sobie refresh time na wyswietlacz

        for(int i = 0; i<=timeInMs/refreshTime; i++){ //licze sobie ile razy ma wykonac się petla odświerzania zeby czas wyświetlania był spełniony
            mainScreen(getAverageBPM(), 10,15, EMPTY, 1);  //to trzeba uzupelnic ladnie o czas trwania do konca badania ktory bedzie obliczny
            vTaskDelay(pdMS_TO_TICKS(refreshTime));
        }
        displayEnabled = false;
        epd.Clear();
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

#include <Arduino.h>
#include "BluetoothSerial.h"
#include "display.h"
#include "HeartMonitor.h"
#include "CsvWriter.h" 
#include "Accelerometer.h"
#include <ArduinoJson.h>
#include <BuzzerManager.h>
#include <driver/adc.h>

//definicje pinow do przyciskow
#define BTN_LCD 39
#define BTN_EVENT 35
#define BTN_T_UP 39
#define BTN_T_DOWN 35
#define MS_PER_HOUR 3600000UL
#define MS_PER_MINUTE 60000UL
#define BATTERY_LEVEL_PIN 36
#define EKG_BUFFER_SIZE 300 //rozmiar buforow do podwojnego buforowania

#define SD_CS_PIN 32
#define DISPLAY_CS_PIN 5

extern SPIClass vspi;
extern SPIClass hspi;

enum DisplayState {
    DISPLAY_OFF,
    DISPLAY_MAIN,
    DISPLAY_END,
    DISPLAY_FIRST_SCREEN
};

class DeviceManager{
    public:
        volatile bool displayEnabled; //zmienna ustawiajaca sie na jeden jak wyswietlacz jest wzbudzony
        volatile bool btEnabled; //zmienna ustawiajaca sie na jeden jak przycisk od BT był nacisniety, zmienna nie zmienia sie poki BT ma klienta
        volatile bool btStarted; //zmienna ustawia sie na true jak zostanie wywowalana funkcja BT.begin() a .end() jeszcze nie została
        volatile bool isMeasuring; //zmienna ustawia sie na true jak zostanie rozpoczete badanie, na false jak zostanie zakonczone/przerwane przyciskiem

        bool SDcardEnabled; //zmienna ktora ustawiona na 1 informauje ze karta jest wpięta
        bool fileSystemEnabled;

        //zmienne potrzebne do obliczania czasu trwania badania
        uint8_t EKGTestTime;
        bool testTimeChosen; // Zmienna określająca czy zakońcono wybór czasu trwania testu
        uint32_t startTime; // Zmienna przechowująca czas rozpoczęcia testu (w milisekundach)

        unsigned long upPressStart = 0; //zmienna do zliczania czasu nacisku przycisku zwiekszajacego czas badania
        unsigned long downPressStart = 0; //zmienna do zliczania czasu nacisku przycisku zmniejszajacego czas badania
        unsigned long confirmPressStart = 0; //zmienna do zliczania czasu nacisku przycisku zapisujacego czas badania

        unsigned long btPressStart = 0; //zmienna do zliczania czasu nacisku przycisku bluetooth
        unsigned long lcdPressStart = 0; //zmienna do zliczania czasu nacisku przycisku wysweitlacza

        volatile int importantButton = 0;

        BluetoothSerial SerialBT;
        CsvWriter holter; //klasa zarzadzajaca holterem
        //Epd epd; //klasa zarzadzajaca wyswietlaczem
        DisplayState currentDisplayState; //zmienna okreslajaca aktualny wyswietlany ekran
        
        MyAccelerometer accel;
        unsigned long lastAccelCheck = 0; 

        // NOWE ZMIENNE DO PODWÓJNEGO BUFOROWANIA:
        Sample bufferA[EKG_BUFFER_SIZE];
        Sample bufferB[EKG_BUFFER_SIZE];
        Sample* currentBuffer;
        Sample* readyToWriteBuffer;
        volatile size_t bufferIndex;

        DeviceManager();
        void init();
        void setStartTime();//funkcja ustawiajaca start badania na aktualna wartosc millis() tak zeby pozniej mozna bylo sprawdzac ile zostalo
        void chooseTestTime(); //funkcja do wyboru czasu trwania badania dziala w petli dopoki nie dokonasz wyboru
        //ta funkcja obsluguje komunikaty dostarczone z aplikacji przez bluetooth
        void checkBluetooth(SemaphoreHandle_t sdMutex); // fucnkja sprawdzajaca czy bluetooth m klienta i sprawdzajaca czy on przypadkiem nic nie wyslal
        void EKGReadingAndSending(); //funkcja odpowiedzialna za czytanie oraz zapis na karcie SD probek badania
        void BTSendingFile(SemaphoreHandle_t sdMutex); //funkcja wysylajaca caly plik lub jego czesc przez bluetooth
        void BTSendingState(); //funkcja wysylajaca stan elektrod oraz stan baterii przez bluetooth
        void updateDisplay(uint32_t timeInMs, SemaphoreHandle_t sdMutex); //funkcja odświerzająca wyświetlacz tyle czasu ile trzeba (pozniej go wylacza) (czas podany w milisekundach)
        void checkButtons(); //funkcja sprawdzajaca przyciski i ustawiajace displayEnabled oraz btEnabled
        void checkTestTimeButtons(); //funkcja sprawdzajaca przyciski podczas wyboru czasu trwania badania
        void waitingForSDcard(); //funkcja działająca w nieskończonej pętli zeby program nie szedl dalej puki nie bedzie karty SD

        battery_level getBatteryIconLevel(uint8_t batteryLevel); //funkcja zwracajaca poziom baterii w formie ikony do wyswietlenia
        uint8_t getBatteryLevel(); //funkcja zwracajaca poziom baterii w procentach
        uint8_t calculateLeftMinutes(); //funkcja obliczajaca ile minyt zostalo do konca badania 
        uint8_t calculateLeftHours(); //funkcja obliczajaca ile godzin zostalo do konca badania
        bool isTimeEnded(); //funkcja sprawdzajaca czy czas badania dobiegł już końca

        void processAccelerometer(); //funkcja odpowiadająca za obliczanie wspolczynnika aktywnosci i opbsluge akclerometru 


        void collectAndBufferSample(TaskHandle_t sdTaskHandle); 
        void writeBufferToSD();

    private:
        volatile float lastActivityValue = -1.0f; // Przechowuje aktualną wartość do zapisu
        volatile bool newActivityReady = false; // Flaga informująca o nowym pomiarze

        int buzzerSampleCounter = 0;
        bool alarmTriggered = false;
        unsigned long lastAlarmTime = 0;

};



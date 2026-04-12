#include <Arduino.h>
#include "BluetoothSerial.h"
#include "display.h"
#include "HeartMonitor.h"
#include "CsvWriter.h" 
/*
=========================/KROTKI OPIS URZADZENIA NA TA CHWILE/============================================

Okej no to ogolnie fa klasa dziala w ten sposob ze zbiera wszystkie urzadzenia peryferyjne i nimi zarzadza,
mowi co sie dzieje i kiedy sie dzieje oraz na co maja reagowac przyciski. Na tą chwile urządzenie dziala w nastepujacy sposob:

- po wlaczeniu urzadzenia wyswietla sie ekran startowy z wyborem czasu trwania badania (w godzinach) i mozna go ustawic przyciskami + i - a 
    zatwierdzic przyciskiem srodkowym
- po zatwierdzeniu czasu trwania badania urzadznie czeka na karte SD i spradza czy nie ma bledu, w takim wypadku wyswietla go
- po wykryciu karty SD i braku bledu urzadzenie zaczyna badanie, czyli zbiera dane z EKG i zapisuje je na karte SD w pliku .csv
- podczas badania mozna nacisnac przycisk od wyswietlacza zeby go wzbudzic i wtedy na ekranie pojawia sie aktualny BPM oraz czas do konca badania
- podczas badania mozna nacisnac przycisk od bluetooth zeby go wzbudzic i wtedy urzadzenie czeka na polaczenie z aplikacja, a po polaczeniu
    czeka na komende GET_EKG i wtedy zaczyna wysylac probki EKG do aplikacji az do momentu otrzymania komendy STOP od aplikacji
- podczas badania mozna nacisnac przycisk od bluetooth zeby go wzbudzic i wtedy urzadzenie czeka na polaczenie z aplikacja, a po polaczeniu
    czeka na komende GET_FILE i wtedy zaczyna wysylac plik z badaniem do aplikacji. Gdy dostanie taka komende wysyła komunikat READY, a następnie czeka na handshake w postaci komunikatu OK (oznacza on, i aplikacja jest gotowa na przyjęcie pliku co troche potrwa). Po dostaniu komunikatu OK urządzenie najpierw wysyla naglowek z nazwa i wielkoscia pliku a potem jego zawartosc.
- po zakonczeniu badania (czyli po uplywie czasu trwania badania albo (TYMCZASOWO) przy naciskaniu srodkowego przycisku) urzadzenie zamyka plik z badaniem i wyswietla komunikat ze 
    badanie sie zakonczylo

=========================/CO JESZCZE TRZEBA DODAC/============================================
- obsluga bledu karty SD podczas badania (np. wyswietlenie komunikatu o bledzie i zakonczenie badania)
- obsluga sytuacji kiedy podczas badania karta SD bedzie pelna (np. wyswietlenie komunikatu o bledzie i zakonczenie badania)
- obsluga Sytuacji odlączenia elektrod podczas badania w postaci aktywnego buzzera oraz wykrzyknika na ekranie głownym aplikacji
- dodanie kolejnego komunikatu  dla Bluetootha GET_STATE, po którym urządzenie odsyłałoby stan elektrod oraz stan baterii urządzenia żeby aplikacja mogla je wyswietlic na żądanie

*/

//definicje pinow do przyciskow
#define BTN_BT 2
#define BTN_LCD 27
#define BTN_MIN 3
#define BTN_T_UP 2
#define BTN_T_DOWN 27
#define BTN_T_CONFIRM 3
#define MS_PER_HOUR 3600000UL
#define MS_PER_MINUTE 60000UL
class DeviceManager{
    public:
        volatile bool displayEnabled; //zmienna ustawiajaca sie na jeden jak wyswietlacz jest wzbudzony
        volatile bool btEnabled; //zmienna ustawiajaca sie na jeden jak przycisk od BT był nacisniety, zmienna nie zmienia sie poki BT ma klienta
        volatile bool btStarted; //zmienna ustawia sie na true jak zostanie wywowalana funkcja BT.begin() a .end() jeszcze nie została

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

        BluetoothSerial SerialBT;
        CsvWriter holter; //klasa zarzadzajaca holterem
        //Epd epd; //klasa zarzadzajaca wyswietlaczem

        DeviceManager();
        void init();
        void setStartTime();//funkcja ustawiajaca start badania na aktualna wartosc millis() tak zeby pozniej mozna bylo sprawdzac ile zostalo
        void chooseTestTime(); //funkcja do wyboru czasu trwania badania dziala w petli dopoki nie dokonasz wyboru
        //ta funkcja obsluguje komunikaty dostarczone z aplikacji przez bluetooth
        void checkBluetooth(); // fucnkja sprawdzajaca czy bluetooth m klienta i sprawdzajaca czy on przypadkiem nic nie wyslal
        void EKGReadingAndSending(); //funkcja odpowiedzialna za czytanie oraz zapis na karcie SD probek badania
        void BTSendingFile();//funkcja wysylajaca caly plik lub jego czesc przez bluetooth
        void updateDisplay(uint32_t timeInMs); //funkcja odświerzająca wyświetlacz tyle czasu ile trzeba (pozniej go wylacza) (czas podany w milisekundach)
        void checkButtons(); //funkcja sprawdzajaca przyciski i ustawiajace displayEnabled oraz btEnabled
        void checkTestTimeButtons(); //funkcja sprawdzajaca przyciski podczas wyboru czasu trwania badania
        void waitingForSDcard(); //funkcja działająca w nieskończonej pętli zeby program nie szedl dalej puki nie bedzie karty SD

        uint8_t calculateLeftMinutes(); //funkcja obliczajaca ile minyt zostalo do konca badania 
        uint8_t calculateLeftHours(); //funkcja obliczajaca ile godzin zostalo do konca badania
        bool isTimeEnded(); //funkcja sprawdzajaca czy czas badania dobiegł już końca
    private:

};



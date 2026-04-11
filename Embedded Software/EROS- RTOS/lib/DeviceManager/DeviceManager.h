#include <Arduino.h>
#include "BluetoothSerial.h"
#include "display.h"
#include "HeartMonitor.h"
#include "CsvWriter.h" 
/*
=========================/KROTKI OPIS URZADZENIA NA TA CHWILE/============================================

Okej no to ogolnie fa klasa dziala w ten sposob ze zbiera wszystkie urzadzenia peryferyjne i nimi zarzadza,
mowi co sie dzieje i kiedy sie dzieje oraz na co maja reagowac przyciski. Jest po to zeby urzadzenie dzialalo 
w miare sekwencyjnie czyli na tą chwile:

- wlaczam urzadzenie i ma pokazac sie ekran ktory bedzie prostym menu wyboru czasu trwania badania.
- jesli wlacze urzadzenie i nie bedzie kart SD albo bedzie problem z systemem plikow, urzadzenie ma powiadamiac o tym fakcie na monitorze (trzeba uzupelnic o tą funkcjonalność funckje waitingForSDCard i dodac odpowiednie widoki ekranu w display.cpp zeby latwo tam je wywołać).
- menu mona zrobic tak ze reaguje na 3 przyciski i mozna sie poruszac po nim: gora, dol oraz zatwierdz.
- po zatwierdzeniu czasu trwania badania urzadzenie przechodzi w tryb pracy na systemie czasu rzeczywistego.
- wybrany czas Badania jest zapisywany w zmiennej EKGegzamineTime po czym zostanie dodany do warunku stopu w funkcji EKGReadingAndSending().
- funkcja EKGReadingAndSending() musi byc uzupelniona o obliczanie czasu (ile trwa badanie) przy uyciu millis() oraz na tej podstawie o warunek stopu.
- dzieki zmiennej wyrzucanej przez millis() zapamietanej w momencie startu badania mozna policzyc (na podstawie aktualnego millis()) ile czasu zostało do końca badania.
- funkcja wyświetlająca głowny ekran urzadzenia podczas trwania badania zostanie uzupelniona o czas do końca badania na tej samej podstawie.
- powinien powstać ekran końcowy do ktorego przechodzi urzadzenie po zakonczeniu badania, informujacy o tym ze wynik mozna miec albo na aplikacji albo ze jest gotowy na karcie SD.
- pelne funkcje wyswietlania ekranow znajduja sie w plikach display.cpp.
- na razie funkcja checkBluetooth dziala w ten sposob ze jesli ktos nacisnie na 3s gorny przycisk to funkcja wysyla komunikat 
    do urzadzenia z ktorym jest sparowany nasz holter (ktokolwiek moze sie z nim sparowac) komunikat READY. Aplikacja musi potwierdzic
    gotowość do dostania danych komunikatem "OK". Jelsi holter zobaczy taki komunikat to wysyła nagłowek o nazwie pliku i jego wielkosci 
    tak zeby aplikacja widziala kiedy bedzie koniec. Nastepnie urzadzenie wysyla pokolei caly plik .csv i na koncu daje komunikat "DONE"
    wszystko było testowane na aplikacji do seriala na windowsie.
- poki co mysle ze mozna zostawic konczenie badania przy nacisnieciu przycisku dla latwych testow urzadzenia.
- trzeba jeszcze poprawic jakos funkcje odswierzania wyswietlacza zeby wykonywala sie szybciej i bez czarnego tla

*/

//definicje pinow do przyciskow
#define BTN_BT 2
#define BTN_LCD 27
#define BTN_MIN 3
#define BTN_T_UP 2
#define BTN_T_DOWN 27
#define BTN_T_CONFIRM 3

class DeviceManager{
    public:
        volatile bool displayEnabled; //zmienna ustawiajaca sie na jeden jak wyswietlacz jest wzbudzony
        volatile bool btEnabled; //zmienna ustawiajaca sie na jeden jak bluetooth przesyla

        bool SDcardEnabled; //zmienna ktora ustawiona na 1 informauje ze karta jest wpięta
        bool fileSystemEnabled;

        //zmienne potrzebne do obliczania czasu trwania badania
        uint8_t EKGTestTime;
        bool testTimeChosen; // Zmienna określająca czy zakońcono wybór czasu trwania testu

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
        void chooseTestTime();
        void checkBluetooth();
        void EKGReadingAndSending();
        void updateDisplay(uint32_t timeInMs); //funkcja odświerzająca wyświetlacz tyle czasu ile trzeba (pozniej go wylacza) (czas podany w milisekundach)
        void checkButtons(); //funkcja sprawdzajaca przyciski i ustawiajace displayEnabled oraz btEnabled
        void checkTestTimeButtons(); //funkcja sprawdzajaca przyciski podczas wyboru czasu trwania badania
        void waitingForSDcard(); //funkcja działająca w nieskończonej pętli zeby program nie szedl dalej puki nie bedzie karty SD

    private:

};



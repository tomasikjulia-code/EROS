# EROS Mobile Sync - Instrukcja Uruchomienia

Projekt mobilny systemu EROS oparty na technologii **React Native** oraz **Expo**. Poniżej znajduje się instrukcja krok po kroku, jak przygotować środowisko i uruchomić aplikację na własnym urządzeniu.

---

## 1. Przygotowanie Visual Studio Code

Aby praca z projektem była wygodna i bezproblemowa, zainstaluj następujące rozszerzenia w VS Code:

* **React Native Tools** – narzędzia do React Native.
* **ES7+ React/Redux/React-Native snippets** – ułatwia pisanie kodu React.
* **Expo Tools** – oficjalne wsparcie dla plików konfiguracyjnych Expo.

---

## 2. Przygotowanie telefonu (Expo Go)

Aplikacja nie wymaga kabla USB do testowania. Wykorzystujemy środowisko **Expo Go**.

1.  Pobierz aplikację **Expo Go** ze sklepu:
    * [App Store (iOS)](https://apps.apple.com/us/app/expo-go/id982107779)
    * [Google Play (Android)](https://play.google.com/store/apps/details?id=host.exp.exponent)
2.  Upewnij się, że Twój telefon oraz komputer są podłączone do **tej samej sieci Wi-Fi**.

---

## 3. Komendy do uruchomienia projektu

Otwórz terminal w folderze `Mobile App/Frontend` i wykonaj poniższe kroki:

### Krok 1: Instalacja zależności
Jeśli pobrałeś projekt po raz pierwszy lub usunąłeś folder `node_modules`, wpisz:
`npm install`

### Krok 2: Kompilacja w Visual Studio Code
W terminalu wpisz: `npx expo start` - aplikacja powinna się skompilować, a w terminalu powinien się pojawić kod QR do zeskanowania.

### Krok 3: Uruchamianie na telefonie
Uruchom aplikację **Expo Go** i wybierz opcję Scan QR, po czym zeskanuj kod wyświetlony w terminalu. Powinno Cię przenieść do aplikacji. Po wprowadzeniu zmiany w VSCode i zapisaniu jej, aplikacja na telefonie powinna się automatycznie odświeżyć. Jeśli tak się nie dzieje, wpisz `r` w terminalu, w którym kompilowana była aplikacja i kliknij `Enter`.

---

## 4. Instalacja z użyciem pliku .apk na Androidzie w celu testowania

Zainstalowana w poniższy sposób aplikacja służy testowaniu. Zapewnia wyświetlanie konsoli w terminalu i możliwość z korzystania funkcji Bluetooth (co nie jest możliwe w przypadku uruchomienia w Expo Go). Ponadto po wgraniu, zmiany w kodzie są automatycznie umieszczane w aplikacji. Działa ona dopóki telefon jest połączeny przez USB, a serwer uruchamiany przy wywołaniu komendy "npx expo run:android" nie został zatrzymany.

### Krok 1: Pobranie Java Development Kit

Ze strony: [Oracle](https://www.oracle.com/java/technologies/javase/jdk17-archive-downloads.html) pobierz instalator JDK 17 dla twojego systemu.
* Windows - Po uruchomieniu instalatora i zakończeniu jego działania:
    * Naciśnij Start
    * Wyszukaj "Edytuj zmienne środowiskowe systemu"
    * Naciśnij Zmienne środowiskowe
    * W sekcji Zmienne systemowe kliknij "Nowa"
    * W sekcji Nazwa zmniennej wpisz "JAVA_HOME"
    * W sekcji Wartość zmiennej wpisz "C:\Program Files\Java\jdk-17" lub inną ścieżkę twojej instalacji i zatwierdź "Ok"
    * W sekcji Zmienne systemowe zaznacz "Path" i kliknij "Edytuj..."
    * Kliknij nowy i wpisz "%JAVA_HOME%\bin", po czym zatwiedź "Ok"

### Krok 2: Pobranie Android Studio

Ze strony: [AndroidStudio](https://developer.android.com/studio?hl=pl) pobierz instalator Android Studio i go uruchom. Po zakończeniu jego działania:
* Windows
    * Naciśnij Start
    * Wyszukaj "Edytuj zmienne środowiskowe systemu"
    * Naciśnij Zmienne środowiskowe
    * W sekcji Zmienne systemowe kliknij "Nowa"
    * W sekcji Nazwa zmniennej wpisz "ANDROID_HOME"
    * W sekcji Wartość zmiennej wpisz ścieżkę twojej instalacji i zatwierdź "Ok". Instalacja będzie prawdopodobnie w "..\AppData\Local\Android\Sdk"
    * W sekcji Zmienne systemowe zaznacz "Path" i kliknij "Edytuj..."
    * Kliknij nowy i wpisz "%ANDROID_HOME%\platform-tools", po czym zatwiedź "Ok"
    * Kliknij nowy i wpisz "%ANDROID_HOME%\emulator", po czym zatwiedź "Ok"
    * Kliknij nowy i wpisz "%ANDROID_HOME%\tools", po czym zatwiedź "Ok"
    * Kliknij nowy i wpisz "%ANDROID_HOME%\tools\bin", po czym zatwiedź "Ok"
Zresetuj terminal/Visual Studio Code

### Krok 3: Łączenie z telefonem

Na telefonie wejdź w Ustawienia -> Telefon - informacje -> Informacje o oprogramowaniu, i naciśnij "Numer wersji" 7 razy, aby uruchomić tryb programisty.
Następnie wejdź w Opcje programisty, włącz "Debugowanie USB". Podepnij telefon do komputera przez USB, pojawi się powiadomienie o połączeniu USB. Wejdź w nie i wybierz "Przesyłanie plików/ Android Auto".

### Krok 4: Budowanie i przesył pliku na telefon

Otwórz terminal w folderze `Mobile App/Frontend` i jeżeli jeszcze tego nie robiłeś wpisz "npm install". Następnie wpisz "npx expo run:android". Rozpocznie się budowanie, a po jego skończeniu plik spróbuje zainstalować się na telefonie.

### Znane błędy

* Jeżeli projekt znajduje się w mocno zagnieżdżonym folderze, niektóre ścieżki plików mogą być za długie dla systemu Windows. Zaleca się w takim wypadku przeniesienie projektu do mniej zagnieżdżonego folderu i powtórzenie kroku 4.
* Jeżeli plik był już zainstalowany na telefonie, po skończeniu budowania instalacja nie powiedzie się. Należy odinstalować plik na telefonie i ponownie wpisać "npx expo run:android".


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

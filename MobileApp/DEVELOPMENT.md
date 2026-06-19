# RYTHMIO Frontend – Lokalny Rozwój

Przewodnik dla deweloperów. Uzupełnienie głównego [`README.md`](README.md), który opisuje setup środowiska.

---

## Szybki start (bez holtera)

```bash
cd MobileApp/Frontend
npm install
npm run start:mock
```

Nie trzeba nic edytować — flaga jest przekazywana przez zmienną środowiskową.

---

## Tryby uruchomienia

| Komenda | Bluetooth | Pliki | PDF | Kiedy używać |
|---|---|---|---|---|
| `npm run start:mock` | ✅ mock | ✅ | ✅ | Expo Go / QR, testowanie UX |
| `npm run start:mock:web` | ✅ mock | ⚠️ stub | ❌ | Szybki podgląd UI w przeglądarce |
| `npm run android:mock` | ✅ mock | ✅ | ✅ | Pełna APK przez USB, console.log w terminalu |
| `npm start` | 🔵 fizyczny | ✅ | ✅ | Expo Go z prawdziwym holterem *(rzadko)* |
| `npm run android` | 🔵 fizyczny | ✅ | ✅ | APK produkcyjna z holterem |

> **Expo Go** nie obsługuje natywnego Bluetooth (react-native-bluetooth-classic wymaga native build).
> Dzięki mockowi (`npm run start:mock`) działa bez ograniczeń — cały przepływ danych jest symulowany.

---

## Co symuluje mock (`MockBluetoothSerial.js`)

Po naciśnięciu przycisku **Bluetooth** w aplikacji mock automatycznie:

1. **"Paruje"** urządzenie `RYTHMIO` (bez żadnego okna uprawnień)
2. Wysyła **dane diagnostyczne** (bateria 87%, 3 elektrody OK)
3. Po naciśnięciu **LIVE EKG** — strumieniuje próbki EKG co 4 ms (format `E12345`)
4. Po naciśnięciu **POBIERZ BADANIE** — generuje i przesyła plik CSV (~15 000 linii)

### Scenariusz wygenerowanego badania (5 minut, 50 Hz)

```
  0 –  60 s │ Rytm zatokowy  72 BPM  (pomijane przez algorytm – IGNORE_FIRST_MS)
 60 – 120 s │ Rytm zatokowy  72 BPM
120 – 180 s │ Tachykardia   115 BPM  ← wykryty epizod w raporcie
180 – 210 s │ Powrót         85 BPM
210 – 250 s │ Bradykardia    42 BPM  ← wykryty epizod w raporcie
250 – 270 s │ Powrót         62 BPM
270 – 271 s │ Ważne zdarzenie (Important = 1) ← widoczne w wycinku EKG
271 – 300 s │ Rytm zatokowy  68 BPM
```

Raport powinien pokazać: **1 epizod tachykardii, 1 bradykardii, 1 ważne zdarzenie**.

---

## Jak działa przełącznik

Zmienna środowiskowa `EXPO_PUBLIC_MOCK_BT` jest wbudowywana przez Metro w momencie startu.
`src/config/Config.js` ją odczytuje:

```js
export const USE_MOCK_BT = process.env.EXPO_PUBLIC_MOCK_BT === 'true';
```

`cross-env` w skryptach npm zapewnia kompatybilność z Windows, macOS i Linux.

Przy `false` (brak zmiennej lub `npm start` / `npm run android`) wymagany jest telefon z APK dev i sparowany holter w ustawieniach systemu.

---

## Tryb Web — znane ograniczenia

| Funkcja | Status |
|---|---|
| UI, wykresy, nawigacja | ✅ działa |
| Live EKG (mock) | ✅ działa |
| Pobieranie badania (mock CSV) | ⚠️ `appendFile` jest no-op (stub w `src/mocks/react-native-fs.web.js`), analiza mimo to uruchamia się na wygenerowanych danych |
| Generowanie PDF (`expo-print`) | ❌ nie działa na web |
| Wysyłanie e-mail (`expo-mail-composer`) | ❌ nie działa na web |
| Powiadomienia push | ❌ nie działa na web |

---

## Przydatne komendy

```bash
# Wyczyść cache Metro i zacznij od nowa
npx expo start --clear

# Przebuduj projekt natywny (po zmianie pluginów / app.json)
npx expo prebuild --clean
npx expo run:android

# Sprawdź podłączone urządzenia ADB
adb devices
```

---

## Struktura plików (Frontend)

```
src/
├── config/
│   └── Config.js              ← przełącznik USE_MOCK_BT
├── screens/
│   ├── HomeScreen.js          ← dashboard, BT, live EKG
│   ├── HistoryScreen.js       ← archiwum badań
│   ├── ReportScreen.js        ← raport kliniczny, PDF, e-mail
│   └── SettingsScreen.js      ← asystent głosowy, powiadomienia
├── components/
│   ├── LiveEcgChart.js        ← wykres live (z EcgBuffer)
│   ├── TrendChart.js          ← trend BPM w czasie
│   ├── ActivityChart.js       ← aktywność pacjenta
│   ├── EcgStrip.js            ← wycinek EKG w raporcie
│   └── DeviceDiagnostics.js   ← stan holtera
├── utils/
│   ├── BluetoothSerial.js     ← produkcyjna obsługa BT Classic
│   ├── MockBluetoothSerial.js ← mock BT (identyczne API)
│   ├── CsvParser.js           ← parsowanie pliku + detekcja szumów
│   ├── EcgBuffer.js           ← cykliczny bufor 1000 próbek
│   ├── AIService.js           ← komunikacja z API AI (192.168.1.18:8000)
│   └── Generators.js          ← generatory danych mockowych
├── constants/
│   └── Theme.js               ← StyleSheet + paleta kolorów
└── mocks/
    └── react-native-fs.web.js ← stub RNFS dla platformy web
App.js                         ← logika główna, analiza EKG, PDF
```

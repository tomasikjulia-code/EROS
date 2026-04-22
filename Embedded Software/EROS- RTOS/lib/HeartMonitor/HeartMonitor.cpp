#include "HeartMonitor.h"

Adafruit_ADS1115 ads;
/**
 * @brief Inicjalizuje moduł monitora serca. Konfiguruje piny wejściowe LO+/- do wykrywania odpięcia elektrod, 
 * ustawia prędkość magistrali I2C na 400kHz oraz konfiguruje przetwornik ADS1115 (wzmocnienie x4, prędkość próbkowania 475 SPS). 
 * Zeruje również bufory średniej kroczącej i MWI.
 */
void initHeartMonitor() {
    pinMode(LO_PLUS, INPUT);
    pinMode(LO_MINUS, INPUT);
    Wire.setClock(400000);
    if (!ads.begin()) Serial.println("Błąd ADS1115!");
    ads.setGain(GAIN_FOUR); 
    ads.setDataRate(RATE_ADS1115_475SPS);
    
    for (int i = 0; i < NUM_READINGS; i++) readings[i] = 0;
    for (int i = 0; i < MWI_WINDOW; i++) mwiBuffer[i] = 0;
}

/**
 * @brief Sprawdza, czy elektrody EKG są poprawnie podłączone do ciała pacjenta.
 * @return bool – Zwraca true, jeśli wykryto odpięcie co najmniej jednej elektrody (stan wysoki na pinach LO+ lub LO-), w przeciwnym razie false.
 */
bool isLeadOff() {

return (digitalRead(LO_PLUS) == 1) || (digitalRead(LO_MINUS) == 1);

} 
/**
 * @brief Główna funkcja przetwarzająca sygnał EKG w czasie rzeczywistym przy użyciu algorytmu Pan-Tompkinsa.
 * Fazy działania:
    ->Filtrowanie: Usuwa składową stałą i szumy wysokoczęstotliwościowe (EMA).
    ->Różniczkowanie: Oblicza nachylenie sygnału w celu wykrycia stromych zboczy zespołu QRS.
    ->Potęgowanie: Podnosi wynik do kwadratu, aby wyeliminować wartości ujemne i nieliniowo wzmocnić najwyższe piki.
    ->Całkowanie (MWI): Wygładza sygnał w oknie czasowym, tworząc impulsy energii.
    ->Detekcja i Obliczanie BPM: Wykrywa przekroczenie progu PT_THRESHOLD z uwzględnieniem histerezy i czasu martwego, 
    a następnie aktualizuje średnią kroczącą BPM.
 */
void processHeartRate() {
    if (isLeadOff()) { 
        averageBPM = 0; 
        hbeat = false; 
        firstBeat = true;
        return;
    }

    int16_t rawValue = ads.readADC_Differential_0_1();

    lowPassValue = (ALPHA * (float)rawValue) + ((1.0 - ALPHA) * lowPassValue);
    slowAverage = (0.005 * lowPassValue) + (0.995 * slowAverage);
    filteredValue = lowPassValue - slowAverage;

    float derivative = filteredValue - lastValue;
    lastValue = filteredValue;

    float squared = derivative * derivative;

    mwiSum -= mwiBuffer[mwiIndex];
    mwiBuffer[mwiIndex] = squared;
    mwiSum += mwiBuffer[mwiIndex];
    mwiIndex = (mwiIndex + 1) % MWI_WINDOW;

    integratedSignal = mwiSum / MWI_WINDOW;

    unsigned long currentTime = millis();

    if (integratedSignal > PT_THRESHOLD && !hbeat) {      
        if (currentTime - lastBeatTime > 400) { 
            if (!firstBeat) {
                unsigned long duration = currentTime - lastBeatTime;
                if (duration > 200 && duration < 2000) {
                    int currentBPM = 60000 / duration;
                    
                    totalBPM -= readings[readIndex];
                    readings[readIndex] = currentBPM;
                    totalBPM += readings[readIndex];
                    readIndex = (readIndex + 1) % NUM_READINGS;
                    averageBPM = totalBPM / NUM_READINGS;
                }
            }
            lastBeatTime = currentTime;
            firstBeat = false;
            hbeat = true; 
        }
    } 
    if (integratedSignal < (PT_THRESHOLD * 0.4)) {
        hbeat = false;
    }
}
/**
 * @brief Pobiera aktualną wartość sygnału EKG po odfiltrowaniu składowej stałej (pływania linii bazowej).
 * @return float – Wartość sygnału wycentrowana wokół zera, gotowa do wyświetlenia na wykresie.
 */
float getFilteredValue() { return filteredValue; }
/**
 * @brief Pobiera aktualną, uśrednioną wartość uderzeń serca na minutę.
 * @return int – Wartość BPM wyliczona na podstawie ostatniej serii poprawnych uderzeń (NUM_READINGS).
 */
int getAverageBPM() { return averageBPM; }
/**
 * @brief Zwraca stan flagi detekcji pojedynczego uderzenia serca.
 * @return bool – true w momencie wykrycia piku R (trwa do czasu resetu przez histerezę), przydatne do sterowania diodą LED lub dźwiękiem buzzera.
 */
bool isHeartBeatDetected() { return hbeat; } 
/**
 * @brief Pobiera wartość sygnału po przejściu przez fazę całkowania algorytmu Pan-Tompkinsa.
 * @return float – Wartość energii sygnału (tzw. "słupki energii"), używana głównie do kalibracji progu PT_THRESHOLD.
 */
float getIntegratedSignal() { return integratedSignal; }
#include "HeartMonitor.h"
#define DEBUG_HEART_RATE true

SPIClass hspi(HSPI);
ads1292r ADS1292R(hspi);

ads1292OutputValues ecgRespirationValues;

void initHeartMonitor() {
    
    pinMode(ADS1292_DRDY_PIN, INPUT);
    pinMode(ADS1292_CS_PIN, OUTPUT);
    pinMode(ADS1292_START_PIN, OUTPUT);
    pinMode(ADS1292_PWDN_PIN, OUTPUT);


    ADS1292R.ads1292Init(ADS1292_CS_PIN, ADS1292_PWDN_PIN, ADS1292_START_PIN);
    Serial.println("ADS1292R init done");

    for (uint8_t i = 0; i < NUM_READINGS; i++) readings[i] = 0;
    for (uint8_t  i = 0; i < MWI_WINDOW; i++) mwiBuffer[i] = 0;

    spki = 400000.0f;
    npki = 50000.0f;
    dynamicThreshold = 200000.0f;
    maxSignalThisBeat = 0;
    mwiSum = 0;
    mwiIndex = 0;

}

bool isLeadOff() {
    return ecgRespirationValues.leadoffDetected;
} 
/**
 * @brief Główna funkcja przetwarzająca sygnał EKG w czasie rzeczywistym przy użyciu algorytmu Pan-Tompkinsa.
 * Implementuje adaptacyjny próg detekcji.
 * * Fazy działania:
    ->Filtrowanie: Usuwa składową stałą (centrowanie sygnału) i odcina szumy mięśniowe/sieciowe (filtr EMA).
    ->Różniczkowanie: Oblicza pochodną sygnału, aby uwypuklić strome zbocza załamka R w zespole QRS.
    ->Potęgowanie: Podnosi wynik do kwadratu, eliminując wartości ujemne i nieliniowo wzmacniając najwyższe piki.
    ->Całkowanie (MWI): Analizuje energię sygnału w ruchomym oknie czasowym, tworząc stabilny profil fali QRS.
    ->Detekcja i Adaptacja: Wykrywa uderzenie serca poprzez przekroczenie dynamicznego progu (dynamicThreshold). 
      Wykorzystuje czas martwy (blokada refrakcji) oraz histerezę (opadnięcie poniżej 40% progu) do poprawnej separacji impulsów.
    ->Śledzenie Sygnału i Szumu (SPKI/NPKI): Na bieżąco uaktualnia średnią energię poprawnych uderzeń (SPKI) oraz 
      szumu tła (NPKI), co pozwala na automatyczne "pływanie" progu detekcji wraz ze zmianą pozycji ciała pacjenta.
    ->Obliczanie i Logowanie BPM: Wyznacza interwał RR, oblicza chwilowe oraz średnie kroczące BPM, 
      a następnie wypisuje dane diagnostyczne do terminala.
 */
bool processHeartRate() {

    bool ret = ADS1292R.getAds1292EcgAndRespirationSamples(ADS1292_DRDY_PIN, ADS1292_CS_PIN, &ecgRespirationValues);
    
    if (!ret) return false;

    static bool wasLeadOff = false;

    if (isLeadOff()) { 
        averageBPM = 0; 
        hbeat = false; 
        firstBeat = true;
        wasLeadOff = true;
        return true; 
    }

    if (wasLeadOff) {
        spki = 400000.0f;
        npki = 50000.0f;
        dynamicThreshold = 200000.0f;
        maxSignalThisBeat = 0;
        
        mwiSum = 0;
        mwiIndex = 0;
        for (uint8_t i = 0; i < MWI_WINDOW; i++) {
            mwiBuffer[i] = 0;
        }

        totalBPM = 0;
        readIndex = 0;
        for (uint8_t i = 0; i < NUM_READINGS; i++) {
            readings[i] = 0;
        }

        wasLeadOff = false;
        //Serial.println(F("\n>>> Elektrody podłączone ponownie - zresetowano progi Pan-Tompkinsa <<<"));
    }

    int32_t rawValue = (int32_t)(ecgRespirationValues.sDaqVals[1]);

    slowAverage = (0.001f * (float)rawValue) + (0.999f * slowAverage);
    float centered = (float)rawValue - slowAverage;
    filteredValue = (ALPHA * centered) + ((1.0f - ALPHA) * filteredValue);

    //Serial.print(">FiltredValue:");
    //Serial.println(getFilteredValue());

    float derivative = filteredValue - lastValue;
    lastValue = filteredValue;
    float squared = derivative * derivative;

    mwiSum -= mwiBuffer[mwiIndex];
    mwiBuffer[mwiIndex] = squared;
    mwiSum += mwiBuffer[mwiIndex];
    mwiIndex = (mwiIndex + 1) % MWI_WINDOW;

    integratedSignal = mwiSum / (float)MWI_WINDOW;

    //Serial.print(">integratedSignal:");
    //Serial.println(integratedSignal);

    unsigned long currentTime = millis();

    if (hbeat) {
        if (integratedSignal > maxSignalThisBeat) {
            maxSignalThisBeat = integratedSignal;
        }
    }
    if (integratedSignal > dynamicThreshold && integratedSignal < PT_MAX_LIMIT) {      
        if (!hbeat && (currentTime - lastBeatTime > REFRACTORY_PERIOD)) { 
            
            if (!firstBeat) {
                unsigned long duration = currentTime - lastBeatTime;
                
                if (duration >= REFRACTORY_PERIOD && duration <= 2000) {
                    int currentBPM = 60000 / duration;
                    
                    totalBPM -= readings[readIndex];
                    readings[readIndex] = currentBPM;
                    totalBPM += readings[readIndex];
                    readIndex = (readIndex + 1) % NUM_READINGS;
                    averageBPM = totalBPM / NUM_READINGS;

                    // Serial.print("BPM chwilowe: ");
                    // Serial.print(currentBPM);
                    // Serial.print("\t| Średnie: ");
                    // Serial.print(averageBPM);
                    // Serial.print("\t| Próg dynamiczny: ");
                    // Serial.println(dynamicThreshold);
                }
            }
            lastBeatTime = currentTime;
            firstBeat = false;
            hbeat = true; 
            maxSignalThisBeat = integratedSignal; 
        }
    }
    
    if (integratedSignal < (dynamicThreshold * 0.4f)) {
        if (hbeat) {
            spki = (0.125f * maxSignalThisBeat) + (0.875f * spki);
        }
        hbeat = false;
    }

    if (!hbeat && (currentTime - lastBeatTime > REFRACTORY_PERIOD)) {
        npki = (0.05f * integratedSignal) + (0.95f * npki);
    }

    dynamicThreshold = npki + 0.25f * (spki - npki);

    if (dynamicThreshold < 50000.0f) {
        dynamicThreshold = 50000.0f;
    }
    return ret;
}
/**
 * @brief Pobiera aktualną wartość sygnału EKG po odfiltrowaniu składowej stałej.
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
 * @return bool – true w momencie wykrycia piku R (trwa do czasu resetu przez histerezę).
 */
bool isHeartBeatDetected() { return hbeat; } 
/**
 * @brief Pobiera wartość sygnału po przejściu przez fazę całkowania algorytmu Pan-Tompkinsa.
 * @return float – Wartość energii sygnału, używana głównie do kalibracji progu PT_THRESHOLD.
 */
float getIntegratedSignal() { return integratedSignal; }
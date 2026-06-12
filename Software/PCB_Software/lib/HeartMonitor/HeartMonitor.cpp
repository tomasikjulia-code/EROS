#include "HeartMonitor.h"

SPIClass hspi(HSPI);
ads1292r ADS1292R(hspi);

ads1292OutputValues ecgRespirationValues;
boolean ret;


void initHeartMonitor() {
    
    pinMode(ADS1292_DRDY_PIN, INPUT);
    pinMode(ADS1292_CS_PIN, OUTPUT);
    pinMode(ADS1292_START_PIN, OUTPUT);
    pinMode(ADS1292_PWDN_PIN, OUTPUT);


    ADS1292R.ads1292Init(ADS1292_CS_PIN, ADS1292_PWDN_PIN, ADS1292_START_PIN);
    Serial.println("ADS1292R init done");

    for (int i = 0; i < NUM_READINGS; i++) readings[i] = 0;
    for (int i = 0; i < MWI_WINDOW; i++) mwiBuffer[i] = 0;

}

bool isLeadOff() {
    return ecgRespirationValues.leadoffDetected;
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
bool processHeartRate() {

    ret = ADS1292R.getAds1292EcgAndRespirationSamples(ADS1292_DRDY_PIN, ADS1292_CS_PIN, &ecgRespirationValues);
    
    if (!ret){
        Serial.println("Błąd podczas odczytu próbek ECG i oddechu.");
        return false;
    }

    if (isLeadOff()) { 
        averageBPM = 0; 
        hbeat = false; 
        firstBeat = true;
        return true; 
    }

    int32_t rawValue = (int32_t)(ecgRespirationValues.sDaqVals[1]);

    slowAverage = (0.001f * (float)rawValue) + (0.999f * slowAverage);
    float centered = (float)rawValue - slowAverage;
    filteredValue = (ALPHA * centered) + ((1.0f - ALPHA) * filteredValue);

    
    Serial.print(">FiltredValue:");
    Serial.println(getFilteredValue());

    float derivative = filteredValue - lastValue;
    lastValue = filteredValue;
    float squared = derivative * derivative;

    mwiSum -= mwiBuffer[mwiIndex];
    mwiBuffer[mwiIndex] = squared;
    mwiSum += mwiBuffer[mwiIndex];
    mwiIndex = (mwiIndex + 1) % MWI_WINDOW;

    integratedSignal = mwiSum / MWI_WINDOW;

    unsigned long currentTime = millis();

    if (integratedSignal > PT_THRESHOLD && integratedSignal < PT_MAX_LIMIT) {      
        if (!hbeat && (currentTime - lastBeatTime > 300)) { 
            
            if (!firstBeat) {
                unsigned long duration = currentTime - lastBeatTime;
                
                if (duration >= 300 && duration <= 2000) {
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
    if (integratedSignal < (PT_THRESHOLD * 0.4f)) {
        hbeat = false;
    }
    //printf(">IntegratedSignal: %f \n", integratedSignal);
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
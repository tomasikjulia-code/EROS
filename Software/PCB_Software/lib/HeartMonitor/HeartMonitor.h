#ifndef HEART_MONITOR_H
#define HEART_MONITOR_H

#include <Arduino.h>
#include "protocentralAds1292r.h"

#define ADS1292_DRDY_PIN 34
#define ADS1292_CS_PIN 15
#define ADS1292_START_PIN 25
#define ADS1292_PWDN_PIN 26

constexpr uint8_t NUM_READINGS = 10;   //Rozmiar bufora do obliczania średniego BPM
constexpr float ALPHA = 0.24f;    //Współczynnik filtru dolnoprzepustowego. Im mniejszy, tym gładszy wykres, ale większe opóźnienie.
constexpr uint16_t THRESHOLD = 6000;   //Poziom sygnału, powyżej którego uznajemy, że wystąpiło uderzenie serca
static float lastValue = 0;   //Poprzednia próbka; służy do wyliczania nachylenia (pochodnej) sygnału.
constexpr uint16_t REFRACTORY_PERIOD = 360; // Czas martwy w ms (zabezpiecza przed zaliczaniem załamka T)

static float mwiSum = 0;
constexpr uint8_t MWI_WINDOW = 24; //Stała definiująca szerokość okna.
static float mwiBuffer[MWI_WINDOW];
static uint8_t mwiIndex = 0;

static float filteredValue = 0; //Filtr dolnoprzepustowy; usuwa szum elektryczny i mięśniowy.
static float lowPassValue = 0;  //Filtr bardzo wolny; śledzi "pływanie" linii bazowej.
static float slowAverage = 0;   //Czysty, wycentrowany sygnał EKG 

static unsigned long lastBeatTime = 0;
static bool firstBeat = true;
static bool hbeat = false;   //Flaga zapobiegająca wielokrotnemu zliczeniu tego samego uderzenia (histereza).

//Mechanizm średniej kroczącej, który stabilizuje wynik BPM wyświetlany użytkownikowi.
static int readings[NUM_READINGS];
static int readIndex = 0;
static int totalBPM = 0;
static int averageBPM = 0;
static float integratedSignal = 0;   //Końcowy sygnał energii, na którym odbywa się detekcja pulsu.


static float spki = 400000.0f;           // Średnia energia poprawnych szczytów QRS
static float npki = 50000.0f;            // Średnia energia szumu tła
static float dynamicThreshold = 200000.0f; // Aktualny dynamiczny próg detekcji
static float maxSignalThisBeat = 0;      // Najwyższa wartość energii znaleziona podczas obecnego pulsu

constexpr uint32_t PT_MAX_LIMIT = 20000000;

void initHeartMonitor();
bool processHeartRate();
float getFilteredValue();
int getAverageBPM();
bool isHeartBeatDetected();
bool isLeadOff();
float getIntegratedSignal();

#endif
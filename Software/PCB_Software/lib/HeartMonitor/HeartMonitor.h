#ifndef HEART_MONITOR_H
#define HEART_MONITOR_H

#include <Arduino.h>
#include "protocentralAds1292r.h"

#define ADS1292_DRDY_PIN 34
#define ADS1292_CS_PIN 15
#define ADS1292_START_PIN 25
#define ADS1292_PWDN_PIN 26

const int NUM_READINGS = 30;   //Rozmiar bufora do obliczania średniego BPM
const float ALPHA = 0.6;    //Współczynnik filtru dolnoprzepustowego. Im mniejszy, tym gładszy wykres, ale większe opóźnienie.
const int THRESHOLD = 6000;   //Poziom sygnału, powyżej którego uznajemy, że wystąpiło uderzenie serca
static float lastValue = 0;   //Poprzednia próbka; służy do wyliczania nachylenia (pochodnej) sygnału.

static float mwiSum = 0;
const int MWI_WINDOW = 20; //Stała definiująca szerokość okna (20 próbek).
static float mwiBuffer[MWI_WINDOW];
static int mwiIndex = 0;

static float filteredValue = 0; //Filtr dolnoprzepustowy; usuwa szum elektryczny i mięśniowy.
static float lowPassValue = 0;  //Filtr bardzo wolny; śledzi "pływanie" linii bazowej.
static float slowAverage = 0;   //Czysty, wycentrowany sygnał EKG 

static unsigned long lastBeatTime = 0;
static bool firstBeat = true;
static bool hbeat = false;   //Flaga zapobiegająca wielokrotnemu zliczeniu tego samego uderzenia (histereza).

//Mechanizm średniej kroczącej, który stabilizuje wynik BPM wyświetlany użytkownikowi.
static int readings[NUM_READINGS];
static int readIndex = 0;
static long totalBPM = 0;
static int averageBPM = 0;
static float integratedSignal = 0;   //Końcowy sygnał energii, na którym odbywa się detekcja pulsu.
const float PT_THRESHOLD = 380000; //Stały próg detekcji energii uderzenia
const int PT_MAX_LIMIT = 20000000;

void initHeartMonitor();
bool processHeartRate();
float getFilteredValue();
int getAverageBPM();
bool isHeartBeatDetected();
bool isLeadOff();
float getIntegratedSignal();

#endif
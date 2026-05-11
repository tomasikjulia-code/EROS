#ifndef HEART_MONITOR_H
#define HEART_MONITOR_H

#include <Arduino.h>
#include <Adafruit_ADS1X15.h>

const int LO_PLUS = 36;
const int LO_MINUS = 39;

const int NUM_READINGS = 10;   //Rozmiar bufora do obliczania średniego BPM
const float ALPHA = 0.3;    //Współczynnik filtru dolnoprzepustowego. Im mniejszy, tym gładszy wykres, ale większe opóźnienie.
const int THRESHOLD =6000;   //Poziom sygnału, powyżej którego uznajemy, że wystąpiło uderzenie serca
static float lastValue = 0;   //Poprzednia próbka; służy do wyliczania nachylenia (pochodnej) sygnału.

//Mechanizm okna całkowania (80ms). Wygładza "energię" uderzenia i eliminuje pojedyncze zakłócenia.
static float mwiSum = 0;
const int MWI_WINDOW = 20; //Stała definiująca szerokość okna (20 próbek).
static float mwiBuffer[MWI_WINDOW];
static int mwiIndex = 0;

static float filteredValue = 0; //Filtr dolnoprzepustowy; usuwa szum elektryczny i mięśniowy.
static float lowPassValue = 0;  //Filtr bardzo wolny; śledzi "pływanie" linii bazowej (np. oddech).
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
const float PT_THRESHOLD = 1500000; //Stały próg detekcji energii uderzenia

void initHeartMonitor();
void processHeartRate();
float getFilteredValue();
int getAverageBPM();
bool isHeartBeatDetected();
bool isLeadOff();
float getIntegratedSignal();

#endif
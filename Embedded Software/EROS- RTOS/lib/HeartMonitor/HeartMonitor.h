#ifndef HEART_MONITOR_H
#define HEART_MONITOR_H

#include <Arduino.h>
#include <Adafruit_ADS1X15.h>

const int LO_PLUS = 36;
const int LO_MINUS = 39;

const int NUM_READINGS = 10;   //Rozmiar bufora do obliczania średniego BPM
const float ALPHA = 0.3;    //Współczynnik filtru dolnoprzepustowego. Im mniejszy, tym gładszy wykres, ale większe opóźnienie.
const int THRESHOLD =6000;   //Poziom sygnału, powyżej którego uznajemy, że wystąpiło uderzenie serca

void initHeartMonitor();
void processHeartRate();
float getFilteredValue();
int getAverageBPM();
bool isHeartBeatDetected();
bool isLeadOff();
float getIntegratedSignal();

#endif
#ifndef HEART_MONITOR_H
#define HEART_MONITOR_H

#include <Arduino.h>

const int ADC_PIN = 34;
const int LO_PLUS = 32;
const int LO_MINUS = 33;

const int NUM_READINGS = 10;
const float ALPHA = 0.3; 
const int THRESHOLD = 2050;

void initHeartMonitor();
void processHeartRate();
float getFilteredValue();
int getAverageBPM();
bool isHeartBeatDetected();
bool isLeadOff();

#endif
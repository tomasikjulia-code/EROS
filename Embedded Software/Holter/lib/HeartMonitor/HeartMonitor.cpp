#include "HeartMonitor.h"

static float filteredValue = 0;
static unsigned long lastBeatTime = 0;
static bool firstBeat = true;
static bool hbeat = false;

static int readings[NUM_READINGS];
static int readIndex = 0;
static long totalBPM = 0;
static int averageBPM = 0;

void initHeartMonitor() {
    pinMode(LO_PLUS, INPUT);
    pinMode(LO_MINUS, INPUT);
    analogSetAttenuation(ADC_11db);
    analogReadResolution(12);

    for (int i = 0; i < NUM_READINGS; i++) readings[i] = 0;
}

bool isLeadOff() {
    return (digitalRead(LO_PLUS) == 1) || (digitalRead(LO_MINUS) == 1);
}

void processHeartRate() {
    if (isLeadOff()) {
        averageBPM = 0;
        return;
    }

    int rawValue = analogRead(ADC_PIN);
    filteredValue = (ALPHA * rawValue) + ((1.0 - ALPHA) * filteredValue);

    if (filteredValue > THRESHOLD && !hbeat) {
        unsigned long currentTime = millis();
        
        if (firstBeat) {
            lastBeatTime = currentTime;
            firstBeat = false;
        } else {
            unsigned long duration = currentTime - lastBeatTime;

            if (duration > 270 && duration < 1500) { 
                int currentBPM = 60000 / duration;

                totalBPM = totalBPM - readings[readIndex];
                readings[readIndex] = currentBPM;
                totalBPM = totalBPM + readings[readIndex];
                readIndex = (readIndex + 1) % NUM_READINGS;
                
                averageBPM = totalBPM / NUM_READINGS;
                lastBeatTime = currentTime;
            }
        }
        hbeat = true;
    } else if (filteredValue < (THRESHOLD - 100)) {
        hbeat = false;
    }
}

float getFilteredValue() { return filteredValue; }
int getAverageBPM() { return averageBPM; }
bool isHeartBeatDetected() { return hbeat; }
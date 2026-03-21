#include <Arduino.h>
#include <SD.h>
#include "HeartMonitor.h"
#include "CsvWriter.h" 

CsvWriter holter; 

void checkStorageStatus() {
    if (!SD.begin()) {
        Serial.println("ERROR: SD card not found!");
        return;
    }
    Serial.println("SD card OK.");
}

void setup() {
    Serial.begin(115200);
    delay(1000); 
    
    initHeartMonitor();
    
    Serial.println("Initializing SD card.");
    if (!SD.begin()) {
        Serial.println("ERROR: SD card does not work properly.");
        return;
    }

    if (holter.begin("/test_ekg.csv")) {
        Serial.println("File opened, press 's' to stop. Writing data...");
    } else {
        Serial.println("ERROR: File system dumped writing to the file.");
    }
}

void loop() {
    if (Serial.available()) {
        char c = Serial.read();
        if (c == 's' || c == 'S') {
            if (holter.isRecording()) {
                holter.closeFile();
                Serial.println(">>> STOP: Plik zapisany i zamkniety! <<<");
            }
        }
    }

    processHeartRate();
    if (holter.isRecording()) {
        int16_t val = isLeadOff() ? 0 : (int16_t)getFilteredValue();
        holter.writeSample(val, getAverageBPM(), isLeadOff());
        
        static unsigned long lastTick = 0;
        if (millis() - lastTick > 1000) {
            Serial.print(".");
            lastTick = millis();
        }
    }

    delay(4); 
}
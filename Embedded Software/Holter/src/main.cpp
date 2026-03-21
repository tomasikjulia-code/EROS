#include <Arduino.h>

const int ADC_PIN = 34;
const int LO_PLUS = 32;
const int LO_MINUS = 33;

float filteredValue = 0;

unsigned long lastBeatTime = 0;
bool firstBeat = true; 

const int numReadings = 10;
int readings[numReadings];
int readIndex = 0;
long totalBPM = 0;
int averageBPM = 0;

const float alpha = 0.3; 
int threshold = 2050;   
bool hbeat = false;

void setup() {
  Serial.begin(115200);
  pinMode(LO_PLUS, INPUT); 
  pinMode(LO_MINUS, INPUT);
  analogSetAttenuation(ADC_11db);
  analogReadResolution(12);

  for (int i = 0; i < numReadings; i++) readings[i] = 0;
}

void loop() {
  if ((digitalRead(LO_PLUS) == 1) || (digitalRead(LO_MINUS) == 1)) {
    Serial.println(">EKG:0");
    Serial.println(">BPM_Srednie:0");
  } else {
    int rawValue = analogRead(ADC_PIN);
    filteredValue = (alpha * rawValue) + ((1.0 - alpha) * filteredValue);

    if (filteredValue > threshold && !hbeat) {
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
          readIndex = (readIndex + 1) % numReadings;
          
          averageBPM = totalBPM / numReadings;
          lastBeatTime = currentTime;
        }
      }
      hbeat = true;
    } else if (filteredValue < (threshold - 100)){
      hbeat = false;
    }

    
    Serial.print(">EKG:");
    Serial.println(filteredValue);
    
    Serial.print(">Prog:"); 
    Serial.println(threshold);

    Serial.print(">BPM_Srednie:");
    Serial.println(averageBPM);
    
    Serial.print(">Trigger:");
    Serial.println(hbeat ? 4000 : 0);
  }
  delay(4); 
}
#ifndef DISPLAY_H
#define DISPLAY_H

#include <Arduino.h>
#include <SPI.h>
#include "epd1in54v2/epd1in54_V2.h"
#include "epd1in54v2/imagedata.h"
#include "epd1in54v2/epdpaint.h"
#include <stdio.h>
#include <string>
#include <cmath>

#define COLORED     0
#define UNCOLORED   1

extern Epd epd; 
enum battery_level{
  FULL,
  THREE_QUARTERS,
  HALF,
  QUARTER,
  EMPTY
};

void displayFirstScreen(uint8_t hours);
void displayMainScreen(uint8_t BPM, uint8_t hours_left, uint8_t minutes_left, battery_level batteryState, bool bluetoothState);
void drawBitmap(int x, int y, int w, int h, const unsigned char* bitmap);
void displayBattery(battery_level level);
void displayBluetooth();
void displayWarningPopUp(const char* message);
void displayBPMValue(uint8_t number);
void displayBPM(uint8_t number);
void displayTimeLeft(uint8_t hours, uint8_t minutes);
void displayTimeChoice();
void displayTimeChoiceValue(uint8_t hours);
void clearDisplay();
void wakeUpDisplay();
void updateBPM(uint8_t BPM);
void updateTimeChoice(uint8_t hours);


#endif
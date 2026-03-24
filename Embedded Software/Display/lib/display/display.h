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

void drawBitmap(int x, int y, int w, int h, const unsigned char* bitmap);
void display_battery(battery_level level);
void display_bluetooth();
void display_BPM_value(uint8_t number);
void display_BPM(uint8_t number);
void displayTimeLeft(uint8_t hours, uint8_t minutes);
void clear_display();


#endif
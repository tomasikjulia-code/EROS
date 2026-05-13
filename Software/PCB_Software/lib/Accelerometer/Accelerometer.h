#ifndef ACCELEROMETER_H
#define ACCELEROMETER_H

#include <Wire.h>
#include "LIS3DHTR.h"

#define WIRE Wire

class MyAccelerometer {
public:
    MyAccelerometer();
    float averageActivity = 0;
    bool begin();
    void readAcceleration(float &x, float &y, float &z);
    float getInstantActivity();
    float getAverageActivity() { return averageActivity; }

private:
    LIS3DHTR<TwoWire> LIS; 
};

#endif
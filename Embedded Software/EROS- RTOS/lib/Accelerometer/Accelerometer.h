#ifndef ACCELEROMETER_H
#define ACCELEROMETER_H

#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <Wire.h>

class MyAccelerometer {
public:
    MyAccelerometer();
    float averageActivity = 0;
    bool begin();
    void readAcceleration(float &x, float &y, float &z);
    void testSensor(int samples = 5);
    float getInstantActivity();
    float getAverageActivity() { return averageActivity; }

private:
    Adafruit_MPU6050 mpu;
};

#endif
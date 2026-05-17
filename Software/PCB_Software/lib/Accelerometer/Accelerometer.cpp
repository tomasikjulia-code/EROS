#include "Accelerometer.h"
#include <Arduino.h>

MyAccelerometer::MyAccelerometer() {}

bool MyAccelerometer::begin() {

    Wire.begin(21, 22);
    Wire.setClock(400000);
    LIS.begin(WIRE, LIS3DHTR_DEFAULT_ADDRESS); 
    delay(100);
    LIS.setOutputDataRate(LIS3DHTR_DATARATE_50HZ);
    if (!LIS)
    {
        Serial.println("LIS3DHTR nie połączył się.");
        return false;
    }
    return true;
}

void MyAccelerometer::readAcceleration(float &x, float &y, float &z) {

    if (LIS) {
        x = LIS.getAccelerationX();
        y = LIS.getAccelerationY();
        z = LIS.getAccelerationZ();
    } else {
        x = y = z = 0;
    }
}

float MyAccelerometer::getInstantActivity() {
    float x, y, z;

    readAcceleration(x, y, z);

    float magnitude = sqrt(x * x + y * y + z * z);
    float rawActivity = abs(magnitude - 1.0f);
    float maxG = 2.0f; 
    float activity = (rawActivity / maxG) * 10.0f;

    if (activity > 10.0f) activity = 10.0f;

    if (activity < 0.2f) return 0.0f;

    return activity;
}

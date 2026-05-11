#include "Accelerometer.h"
#include <Arduino.h>

MyAccelerometer::MyAccelerometer() {}

bool MyAccelerometer::begin() {
    // Sprawdzenie fizycznej obecności
    Wire.beginTransmission(0x68);
    if (Wire.endTransmission() != 0) return false;

    // Inicjalizacja biblioteki (z ignorowaniem błędu ID dla Twojego klona 0x70)
    if (!mpu.begin(0x68)) {
        Serial.println("Info: Wykryto klon MPU6050 (ID 0x70), kontynuuję...");
    }

    mpu.setAccelerometerRange(MPU6050_RANGE_2_G);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
    
    return true;
}
//odczytuje wartości akcelerometru
void MyAccelerometer::readAcceleration(float &x, float &y, float &z) {
    sensors_event_t a, g, temp;
    if (mpu.getEvent(&a, &g, &temp)) {
        x = a.acceleration.x;
        y = a.acceleration.y;
        z = a.acceleration.z;
    } else {
        x = y = z = 0;
    }
}

// zamienia wartości akcelerometru na aktywność
float MyAccelerometer::getInstantActivity() {
    float x, y, z;
    readAcceleration(x, y, z);

    // SVM (Signal Vector Magnitude)
    float magnitude = sqrt(x * x + y * y + z * z);

    // Odejmujemy grawitację (ok. 9.81 m/s^2)
    float activity = abs(magnitude - 9.81f);

    // Filtr szumów (Deadzone)
    return (activity < 0.35f) ? 0.0f : activity;
}

void MyAccelerometer::testSensor(int samples) {
    Serial.println("--- Test Akcelerometru ---");
    for (int i = 0; i < samples; i++) {
        Serial.printf("Aktywność chwilowa: %.2f\n", getInstantActivity());
        delay(200);
    }
}
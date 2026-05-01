#ifndef BUZZER_MANAGER_H
#define BUZZER_MANAGER_H

#include <Arduino.h>

// Configuration
#define BUZZER_PIN 27
#define BUZZER_PWM_CH 0 // ESP32 LEDC Channel
#define BUZZER_FREQ_HZ 2731
#define BUZZER_MOD_INTERVAL 250

class Buzzer
{
  public:
    Buzzer();

    void begin();
    void playContinuous();
    void playModulated();
    void stop();

    void setVolume(uint8_t volume); // 0 to 100%
    uint8_t getVolume();

    // Call this inside loop() or your RTOS task to handle modulation timing
    void update();

  private:
    uint8_t _volume;
    uint32_t _pwmValue;
    bool _isModulated;
    bool _isToneActive;
    unsigned long _lastToggleTime;

    void applyPWM(bool active);
};

extern Buzzer BuzzerManager;

#endif
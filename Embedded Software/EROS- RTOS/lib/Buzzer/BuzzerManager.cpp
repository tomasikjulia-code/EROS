#include "BuzzerManager.h"

Buzzer BuzzerManager;

Buzzer::Buzzer()
{
    _volume = 100;
    _pwmValue = 127; // 50% duty cycle
    _isModulated = false;
    _isToneActive = false;
    _lastToggleTime = 0;
}

void Buzzer::begin()
{
    ledcSetup(BUZZER_PWM_CH, BUZZER_FREQ_HZ, 8); // 8-bit
    ledcAttachPin(BUZZER_PIN, BUZZER_PWM_CH);
    stop();
}

void Buzzer::playContinuous()
{
    _isModulated = false;
    _isToneActive = true;
    applyPWM(true);
}

void Buzzer::playModulated()
{
    _isModulated = true;
    _isToneActive = true;
    _lastToggleTime = millis();
    applyPWM(true);
}

void Buzzer::stop()
{
    _isModulated = false;
    _isToneActive = false;
    applyPWM(false);
}

void Buzzer::setVolume(uint8_t volume)
{
    if (volume > 100)
        volume = 100;
    _volume = volume;

    _pwmValue = map(_volume, 0, 100, 0, 127);

    if (_isToneActive)
    {
        applyPWM(true);
    }
}

uint8_t Buzzer::getVolume() { return _volume; }

void Buzzer::applyPWM(bool active)
{
    if (active && _volume > 0)
    {
        ledcWrite(BUZZER_PWM_CH, _pwmValue);
    }
    else
    {
        ledcWrite(BUZZER_PWM_CH, 0);
    }
}

void Buzzer::update()
{
    if (_isModulated)
    {
        if (millis() - _lastToggleTime >= BUZZER_MOD_INTERVAL)
        {
            _lastToggleTime = millis();
            _isToneActive = !_isToneActive;
            applyPWM(_isToneActive);
        }
    }
}
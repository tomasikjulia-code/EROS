#include <Arduino.h>
#include "BluetoothSerial.h"
#include "display.h"
#include <SD.h>
#include "HeartMonitor.h"
#include "CsvWriter.h" 

BluetoothSerial SerialBT;
CsvWriter holter; 
Epd epd;

/* ===== PINY DO PRZYCISKOW ===== */

#define BTN_BT 2
#define BTN_LCD 21
#define BTN_MIN 3

/* ===== TASK HANDLE ===== */

TaskHandle_t measureTaskHandle;
TaskHandle_t btTaskHandle;
TaskHandle_t displayTaskHandle;

/* ===== FLAGI ===== */

bool btEnabled = false;
bool displayEnabled = false;

/* ===== TIMER BUTTON ===== */

unsigned long btPressStart = 0;
unsigned long lcdPressStart = 0;


/* ============================= */
/* TASK 1 – POMIAR + SD */
/* ============================= */

void measureTask(void *parameter)
{
    while (true)
    {
        /* Kod do pomiarow na karte SD */
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
        vTaskDelay(pdMS_TO_TICKS(4));
    }
}


/* ============================= */
/* TASK 2 – BLUETOOTH */
/* ============================= */

void btTask(void *parameter)
{
    while (true)
    {
        if (btEnabled && SerialBT.hasClient())
        {
            Serial.println("Wysylanie pliku przez BT");

            /* TUTAJ KOD DO PRZESYLANIA PLIKU BLUETOOTH*/
            // sendFileFromSD();

            vTaskDelay(pdMS_TO_TICKS(5000));
        }

        vTaskDelay(pdMS_TO_TICKS(200));
    }
}


/* ============================= */
/* TASK 3 – DISPLAY */
/* ============================= */

void displayTask(void *parameter)
{

    while (true)
    {
        /* KOD DO WYSWIETLACZA*/
        if (displayEnabled){
            for(int i = 0; i<=5; i++){
                display_battery(EMPTY);
                display_bluetooth();
                display_BPM(33+i);
                displayTimeLeft(10,15);
                //epd.DisplayFrame();
                epd.DisplayFrame();

                vTaskDelay(pdMS_TO_TICKS(400));
            }
            displayEnabled = false;
            epd.Clear();

        }
        vTaskDelay(pdMS_TO_TICKS(200));
    }
}


/* ============================= */
/* OBSLUGA PRZYCISKOW */
/* ============================= */

void checkButtons()
{
    /* ===== BUTTON BLUETOOTH ===== */

    static bool btTriggered = false;

    if (digitalRead(BTN_BT) == LOW)
    {
        if (btPressStart == 0)
            btPressStart = millis();

        if (!btTriggered && millis() - btPressStart > 3000)
        {
            btEnabled = true;
            btTriggered = true;
            Serial.println("BT ENABLED");
        }
    }
    else
    {
        btPressStart = 0;
        btTriggered = false;
    }


    /* ===== BUTTON DISPLAY ===== */

    static bool lcdTriggered = false;

    if (digitalRead(BTN_LCD) == LOW)
    {
        if (lcdPressStart == 0)
            lcdPressStart = millis();

        if (!lcdTriggered && millis() - lcdPressStart > 2000)
        {
            displayEnabled = true;
            lcdTriggered = true;
            Serial.println("DISPLAY ENABLED");
        }
    }
    else
    {
        lcdPressStart = 0;
        lcdTriggered = false;
    }
}


/* ============================= */
/* SETUP */
/* ============================= */

void setup()
{
    Serial.begin(115200);

    //PINOUT
    pinMode(BTN_BT, INPUT_PULLUP);
    pinMode(BTN_LCD, INPUT_PULLUP);

    //===== INICJALIZACJE PERYFERIOW =========

    //bluetooth
    SerialBT.begin("ESP32_logger");

    //wyswietlacz
    epd.LDirInit();
    epd.Clear();
    delay(100);

    //EKG
    initHeartMonitor();
    
    //karta SD
    Serial.println("Initializing SD card.");
    if (!SD.begin()) {
        Serial.println("ERROR: SD card does not work properly.");
    }

    if (holter.begin("/test_ekg.csv")) {
        Serial.println("File opened, press 's' to stop. Writing data...");
    } else {
        Serial.println("ERROR: File system dumped writing to the file.");
    }

    /* ===== TWORZENIE TASKOW ===== */

    xTaskCreatePinnedToCore(measureTask,"Measure Task",4096,NULL,2,&measureTaskHandle,1);

    xTaskCreatePinnedToCore(btTask,"BT Task",4096,NULL,1,&btTaskHandle,0);

    xTaskCreatePinnedToCore(displayTask,"Display Task",8192,NULL,1,&displayTaskHandle,0);

}

/* ============================= */
/* LOOP */
/* ============================= */

void loop()
{
    checkButtons();

    vTaskDelay(pdMS_TO_TICKS(100));
}
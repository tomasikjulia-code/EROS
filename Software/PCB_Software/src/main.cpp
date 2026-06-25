#include <Arduino.h>
#include "DeviceManager.h"

//uchwyty na taski
TaskHandle_t measureTaskHandle;
TaskHandle_t btTaskHandle;
TaskHandle_t displayTaskHandle;
TaskHandle_t accelTaskHandle;
TaskHandle_t sdWriteTaskHandle; 
TaskHandle_t buttonTaskHandle; 

//uchwyty na mutexy
SemaphoreHandle_t displayMutex;
SemaphoreHandle_t btMutex;
SemaphoreHandle_t sdMutex;
SemaphoreHandle_t accMutex;

DeviceManager HolterDevice;


void measureTask(void *parameter)
{   

    HolterDevice.setStartTime();
    TickType_t xLastWakeTime = xTaskGetTickCount();
    const TickType_t xFrequency = pdMS_TO_TICKS(4); 

    while (true)
    {
        vTaskDelayUntil(&xLastWakeTime, xFrequency); 
        HolterDevice.collectAndBufferSample(sdWriteTaskHandle);
    }
}

void sdWriteTask(void *parameter)
{
    while (true)
    {
        ulTaskNotifyTake(pdTRUE, portMAX_DELAY);
        //HolterDevice.writeBufferToSD(sdMutex);
        //Serial.println(">>> Zapisano bufor na kartę SD <<<");
        unsigned long startWrite = millis();
        HolterDevice.writeBufferToSD(sdMutex);
        unsigned long writeTime = millis() - startWrite;
        if (writeTime > 100) {
            Serial.printf("UWAGA: Zapis na SD trwał %lu ms\n", writeTime);
        }
    }
}
void btTask(void *parameter)
{
    while (true)
    {
        if (xSemaphoreTake(btMutex, portMAX_DELAY))
        {  
            HolterDevice.checkBluetooth(sdMutex);
            xSemaphoreGive(btMutex);
        }
        vTaskDelay(pdMS_TO_TICKS(200));
    }
}

void displayTask(void *parameter)
{
    while (true)
    {
        if (xSemaphoreTake(displayMutex, portMAX_DELAY))
        {   
            HolterDevice.updateDisplay(2000, sdMutex);
            xSemaphoreGive(displayMutex);
        }
        vTaskDelay(pdMS_TO_TICKS(100));
    }
}

void accelTask(void *parameter) {

    while (true)
    {
        if (xSemaphoreTake(accMutex, portMAX_DELAY))
        {  
            HolterDevice.processAccelerometer();
            xSemaphoreGive(accMutex);
        }
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}

void buttonTask(void *parameter) {

    while (true)
    {
        HolterDevice.checkButtons();
        vTaskDelay(pdMS_TO_TICKS(500));
    }
}

void setup()
{
    HolterDevice.init();
    displayMutex = xSemaphoreCreateMutex();
    btMutex = xSemaphoreCreateMutex();
    sdMutex = xSemaphoreCreateMutex();
    accMutex = xSemaphoreCreateMutex();
    
    HolterDevice.chooseTestTime();
    
    xSemaphoreTake(sdMutex, portMAX_DELAY);
    HolterDevice.waitingForSDcard();
    xSemaphoreGive(sdMutex);


    xTaskCreatePinnedToCore(measureTask, "Measure Task", 4096, NULL, 3, &measureTaskHandle, 1);
    xTaskCreatePinnedToCore(sdWriteTask, "SD Write Task", 4096, NULL, 2, &sdWriteTaskHandle, 0);
    xTaskCreatePinnedToCore(btTask, "BT Task", 4096, NULL, 2, &btTaskHandle, 0);
    xTaskCreatePinnedToCore(displayTask, "Display Task", 4096, NULL, 1, &displayTaskHandle, 0);
    xTaskCreatePinnedToCore(accelTask, "Accel Task", 2048, NULL, 1, &accelTaskHandle, 0);
    xTaskCreatePinnedToCore(buttonTask, "Button Task", 1024, NULL, 1, &buttonTaskHandle, 0);

}
void loop(){
    vTaskDelay(pdMS_TO_TICKS(20000));

}

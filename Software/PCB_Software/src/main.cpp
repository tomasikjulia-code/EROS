#include <Arduino.h>
#include "DeviceManager.h"

//uchwyty na taski
TaskHandle_t measureTaskHandle;
TaskHandle_t btTaskHandle;
TaskHandle_t displayTaskHandle;
TaskHandle_t accelTaskHandle;
TaskHandle_t sdWriteTaskHandle; 

QueueHandle_t sdWriteQueue;

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
        HolterDevice.collectAndBufferSample();
    }
}

// void sdWriteTask(void *parameter)
// {
//     while (true)
//     {
//         ulTaskNotifyTake(pdTRUE, portMAX_DELAY);
//         if (xSemaphoreTake(sdMutex, portMAX_DELAY))
//         {
//             HolterDevice.writeBufferToSD();
//             xSemaphoreGive(sdMutex);
//         }
//     }
// }

void sdWriteTask(void *parameter) {
    Sample* bufferToWrite = nullptr;
    while (true) {
        if (xQueueReceive(sdWriteQueue, &bufferToWrite, portMAX_DELAY)) {
            if (xSemaphoreTake(sdMutex, portMAX_DELAY)) {
                HolterDevice.writeBufferToSD(bufferToWrite);
                xSemaphoreGive(sdMutex);
            }
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
    }
}

void accelTask(void *parameter) {

    while (true) {
        if (xSemaphoreTake(accMutex, portMAX_DELAY))
        {  
            HolterDevice.processAccelerometer();
            vTaskDelay(pdMS_TO_TICKS(1000)); 
            xSemaphoreGive(accMutex);
        }
    }
}
void setup()
{
    HolterDevice.init();
    displayMutex = xSemaphoreCreateMutex();
    btMutex = xSemaphoreCreateMutex();
    sdMutex = xSemaphoreCreateMutex();
    accMutex = xSemaphoreCreateMutex();

    sdWriteQueue = xQueueCreate(4, sizeof(Sample*));
    HolterDevice.setWriteQueue(sdWriteQueue);
    
    HolterDevice.chooseTestTime();
    
    xSemaphoreTake(sdMutex, portMAX_DELAY);
    HolterDevice.waitingForSDcard();
    xSemaphoreGive(sdMutex);


    xTaskCreatePinnedToCore(measureTask, "Measure Task", 4096, NULL, 2, &measureTaskHandle, 1);
    xTaskCreatePinnedToCore(sdWriteTask, "SD Write Task", 10240, NULL, 2, &sdWriteTaskHandle, 0);
    xTaskCreatePinnedToCore(btTask, "BT Task", 16384, NULL, 1, &btTaskHandle, 0);
    xTaskCreatePinnedToCore(displayTask, "Display Task", 8192, NULL, 1, &displayTaskHandle, 0);
    xTaskCreatePinnedToCore(accelTask, "Accel Task", 4096, NULL, 1, &accelTaskHandle, 0);

}
void loop(){
    HolterDevice.checkButtons(); 
    vTaskDelay(pdMS_TO_TICKS(200));

}
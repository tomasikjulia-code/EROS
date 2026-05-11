#include <Arduino.h>
#include "DeviceManager.h"

/*
BARDZIEJ SZCZEOLOWY OPIS DZIALANIA KODU I URZADZENIA JEST ZAMIESZCZEONY W PLIKU DEVICEMANAGER.H
jest tam tez napisane co jeszcze na obecna chwile trzebaby dodac do tej klasy bo to jej metody zarzadzaja 
urzadzeniem, tak aby tutaj w mainie obslugiwac samego RTOS i zeby kod tutaj byl ladny i czytelny.
*/

//uchwyty na taski
TaskHandle_t measureTaskHandle;
TaskHandle_t btTaskHandle;
TaskHandle_t displayTaskHandle;
TaskHandle_t accelTaskHandle;
TaskHandle_t sdWriteTaskHandle; 

//uchwyty na mutexy
SemaphoreHandle_t displayMutex;
SemaphoreHandle_t btMutex;
SemaphoreHandle_t sdMutex;
SemaphoreHandle_t accMutex;


//obiekt klasy DeviceManager zarzadzajacy wszystkim
DeviceManager HolterDevice;

//obiekt klasy accelerometr
MyAccelerometer accel;

void measureTask(void *parameter)
{   
    HolterDevice.setStartTime();
    TickType_t xLastWakeTime = xTaskGetTickCount();
    const TickType_t xFrequency = pdMS_TO_TICKS(4); // Równe 250Hz

    while (true)
    {
        vTaskDelayUntil(&xLastWakeTime, xFrequency); // Precyzyjne 4ms
        HolterDevice.collectAndBufferSample(sdWriteTaskHandle);
    }
}

void sdWriteTask(void *parameter)
{
    while (true)
    {
        // Czeka na sygnał o zapelnieniu buforu
        ulTaskNotifyTake(pdTRUE, portMAX_DELAY);
        if (xSemaphoreTake(sdMutex, portMAX_DELAY))
        {
            HolterDevice.writeBufferToSD();
            xSemaphoreGive(sdMutex);
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
            HolterDevice.updateDisplay(2000);
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
    // ... inicjalizacja peryferiów i mutexów bez zmian ...
    HolterDevice.init();
    displayMutex = xSemaphoreCreateMutex();
    btMutex = xSemaphoreCreateMutex();
    sdMutex = xSemaphoreCreateMutex();
    accMutex = xSemaphoreCreateMutex();
    
    HolterDevice.chooseTestTime();
    
    // WaitingForSDcard też powinno być w mutexie dla porządku
    xSemaphoreTake(sdMutex, portMAX_DELAY);
    HolterDevice.waitingForSDcard();
    xSemaphoreGive(sdMutex);

    // TWORZENIE TASKÓW
    xTaskCreatePinnedToCore(measureTask, "Measure Task", 4096, NULL, 2, &measureTaskHandle, 1);
    xTaskCreatePinnedToCore(sdWriteTask, "SD Write Task", 8192, NULL, 1, &sdWriteTaskHandle, 0);
    xTaskCreatePinnedToCore(btTask, "BT Task", 4096, NULL, 1, &btTaskHandle, 0);
    xTaskCreatePinnedToCore(displayTask, "Display Task", 8192, NULL, 1, &displayTaskHandle, 0);
    xTaskCreatePinnedToCore(accelTask, "Accel Task", 4096, NULL, 1, &accelTaskHandle, 0);
}
void loop(){
    HolterDevice.checkButtons(); //sprawdzam sobie tutaj przyciski bo to troche dziala jak dodatkowy task a nigdzie indziej nie mialem jak
    vTaskDelay(pdMS_TO_TICKS(200));
    //pusto bo tutaj nie ma co wstawiac
}
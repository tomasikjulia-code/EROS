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

//uchwyty na mutexy
SemaphoreHandle_t displayMutex;
SemaphoreHandle_t btMutex;
SemaphoreHandle_t sdMutex;


//obiekt klasy DeviceManager zarzadzajacy wszystkim
DeviceManager HolterDevice;

void measureTask(void *parameter)
{
    while (true)
    {
        if (xSemaphoreTake(sdMutex, portMAX_DELAY))
        {
            HolterDevice.EKGReadingAndSending();
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
            HolterDevice.checkBluetooth();
            vTaskDelay(pdMS_TO_TICKS(200));
            xSemaphoreGive(btMutex);
        }
    }

}

void displayTask(void *parameter)
{
    while (true)
    {
        if (xSemaphoreTake(displayMutex, portMAX_DELAY))
        {   
            HolterDevice.updateDisplay(1000);
            xSemaphoreGive(displayMutex);
        }
    }
}

void setup()
{
    //Inicjalizacja wszystkich peryferiow znajduje sie w metodzie init dla klasy device manager
    HolterDevice.init();

    //inicjalizacja mutexow
    displayMutex = xSemaphoreCreateMutex();
    btMutex = xSemaphoreCreateMutex();
    sdMutex = xSemaphoreCreateMutex();
    
    //wybór czasu trwania badania

    HolterDevice.chooseTestTime();
    
    // // czekanie na karte SD
    HolterDevice.waitingForSDcard();

    //tworzenie taskow
    xTaskCreatePinnedToCore(measureTask,"Measure Task",4096,NULL,2,&measureTaskHandle,1);
    xTaskCreatePinnedToCore(btTask,"BT Task",4096,NULL,1,&btTaskHandle,0);
    xTaskCreatePinnedToCore(displayTask,"Display Task",8192,NULL,1,&displayTaskHandle,0);
}
void loop(){
    HolterDevice.checkButtons(); //sprawdzam sobie tutaj przyciski bo to troche dziala jak dodatkowy task a nigdzie indziej nie mialem jak
    vTaskDelay(pdMS_TO_TICKS(200));
    //pusto bo tutaj nie ma co wstawiac
}
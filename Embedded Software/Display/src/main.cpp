#include "display.h"

Epd epd;
void setup()
{
  Serial.begin(115200);
  Serial.println("e-Paper init and clear");
  epd.LDirInit();
  epd.Clear();

  display_battery(EMPTY);

  display_bluetooth();

  display_BPM(21);

  displayTimeLeft(10,15);

  epd.DisplayFrame();
  delay(10000);

  clear_display();
}
void loop()
{

}
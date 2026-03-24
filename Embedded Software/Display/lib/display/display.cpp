#include "display.h"

unsigned char image[5000];
Paint paint(image, 0, 0);


void drawBitmap(int x, int y, int w, int h, const unsigned char* bitmap) {
    paint.SetWidth(w);
    paint.SetHeight(h);
    paint.Clear(UNCOLORED);
    
    int bytesPerRow = (w + 7) / 8;
    for (int row = 0; row < h; row++) {
        for (int col = 0; col < w; col++) {
            int byteIndex = row * bytesPerRow + col / 8;
            int bitIndex = 7 - (col % 8);
            int pixel = (bitmap[byteIndex] >> bitIndex) & 1;
            if (pixel == 1) {
                paint.DrawPixel(col, row, COLORED);
            }
        }
    }
    epd.SetFrameMemory(paint.GetImage(), x, y, w, h);
}

void display_battery(battery_level level){
switch (level)
{
case FULL:
  drawBitmap(160, 0, 32, 32, FULL_BATTERY);  break;
case THREE_QUARTERS:
  drawBitmap(160, 0, 32, 32, THREE_QUARTERS_BATTERY);  break;
case HALF:
  drawBitmap(160, 0, 32, 32, HALF_BATTERY);  break;
case QUARTER:
  drawBitmap(160, 0, 32, 32, QUARTER_BATTERY);  break;
case EMPTY:
  drawBitmap(160, 0, 32, 32, EMPTY_BATTERY);  break;
default:
  drawBitmap(160, 0, 32, 32, EMPTY_BATTERY);
  break;
}
}

void display_bluetooth(){
  drawBitmap(140, 0, 16, 32, BLUETOOTH);
}

void display_BPM_value(uint8_t number){
  std::string number_str=std::to_string(number);
  uint8_t number_to_display;
  uint8_t number_length=strlen(number_str.c_str());
  uint8_t x_pos=(200-32*number_length)/2;
  for(int i=0;i<strlen(number_str.c_str());i++){
    number_to_display=std::stoi(std::to_string(number_str[i]-'0'));
    drawBitmap(x_pos+32*i, 96, 40, 48, &Font48_Table[number_to_display*240]);
  }

}

void display_BPM(uint8_t number){
  drawBitmap(52, 48, 32, 48, LETTER_B);
  drawBitmap(80, 48, 48, 48, LETTER_P);
  drawBitmap(118, 48, 48, 48, LETTER_M);

  display_BPM_value(number);
}

void displayTimeLeft(uint8_t hours, uint8_t minutes){
  paint.SetWidth(200);
  paint.SetHeight(24);

  std::string text="Time left:"+std::to_string(hours)+"h "+std::to_string(minutes)+"m";
  uint8_t x_pos=(200-strlen(text.c_str())*11)/2;

  paint.Clear(COLORED);
  paint.DrawStringAt(x_pos, 5, text.c_str(), &Font16, UNCOLORED);
  epd.SetFrameMemory(paint.GetImage(), 0, 176, paint.GetWidth(), paint.GetHeight());
}

void clear_display(){
  Serial.println("e-Paper clear and goto sleep");
  paint.SetWidth(200);
  paint.SetHeight(200);
  paint.Clear(UNCOLORED);

  epd.SetFrameMemory(paint.GetImage(), 0, 0, 200, 200);
  epd.DisplayFrame();

  epd.Sleep();
}
#include "display.h"

Epd epd; //dodalem tutaj definicje obiektu epd jak cos szymek bo ona i tak byla globalna i nie moglem tego zrobic jako pole klasy Device manager
unsigned char image[5000];
Paint paint(image, 0, 0);


void drawBitmap(int x, int y, int w, int h, const unsigned char* bitmap) {
  int xOffset = x % 8;
  int alignedX = x - xOffset;
  int alignedW = w + xOffset;
  alignedW = (alignedW + 7) & ~7;

  paint.SetWidth(alignedW);
  paint.SetHeight(h);
  paint.Clear(UNCOLORED);

  int bytesPerRow = (w + 7) / 8;
  for (int row = 0; row < h; row++) {
      for (int col = 0; col < w; col++) {
          int byteIndex = row * bytesPerRow + col / 8;
          int bitIndex = 7 - (col % 8);
          int pixel = (bitmap[byteIndex] >> bitIndex) & 1;
          if (pixel == 1) {
              paint.DrawPixel(col + xOffset, row, COLORED);
          }
      }
  }

  epd.SetFrameMemoryPartial(paint.GetImage(), alignedX, y, alignedW, h);
}

void displayBattery(battery_level level){
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

void displayBluetooth(){
  drawBitmap(140, 0, 16, 32, BLUETOOTH);
}

void displayBPMValue(uint8_t number){
  paint.SetWidth(200);
  paint.SetHeight(48);
  paint.Clear(UNCOLORED);
  epd.SetFrameMemoryPartial(paint.GetImage(), 0, 96, 200, 48);
  
  std::string number_str=std::to_string(number);
  uint8_t number_to_display;
  uint8_t number_length=strlen(number_str.c_str());
  uint8_t x_pos=(200-40*number_length)/2;
  for(int i=0;i<strlen(number_str.c_str());i++){
    number_to_display=std::stoi(std::to_string(number_str[i]-'0'));
    drawBitmap(x_pos+40*i, 96, 40, 48, &Font48_Table[number_to_display*240]);
  }

}

void displayBPM(uint8_t number){
  drawBitmap(52, 48, 32, 48, LETTER_B);
  drawBitmap(80, 48, 48, 48, LETTER_P);
  drawBitmap(112, 48, 48, 48, LETTER_M);

  displayBPMValue(number);
}

void displayTimeLeft(uint8_t hours, uint8_t minutes){
  paint.SetWidth(200);
  paint.SetHeight(24);

  std::string text="Time left:"+std::to_string(hours)+"h "+std::to_string(minutes)+"m";
  uint8_t x_pos=(200-strlen(text.c_str())*11)/2;

  paint.Clear(COLORED);
  paint.DrawStringAt(x_pos, 5, text.c_str(), &Font16, UNCOLORED);
  epd.SetFrameMemoryPartial(paint.GetImage(), 0, 176, paint.GetWidth(), paint.GetHeight());
}

void clearDisplay(){
  paint.SetWidth(200);
  paint.SetHeight(200);
  paint.Clear(UNCOLORED);

  epd.SetFrameMemoryPartial(paint.GetImage(), 0, 0, 200, 200);
  epd.DisplayPartFrame();
  epd.WaitUntilIdle();
  
  epd.DisplayPartBaseWhiteImage();
  epd.WaitUntilIdle();

  epd.Sleep();

}

void displayTimeChoice(){
  paint.SetWidth(200);
  paint.SetHeight(24);

  std::string text="Choose test time:";
  uint8_t x_pos=(200-strlen(text.c_str())*11)/2;

  paint.Clear(COLORED);
  paint.DrawStringAt(x_pos, 5, text.c_str(), &Font16, UNCOLORED);
  epd.SetFrameMemoryPartial(paint.GetImage(), 0, 0, paint.GetWidth(), paint.GetHeight());
}

void displayTimeChoiceValue(uint8_t hours){
  int i;
  std::string number_str=std::to_string(hours);
  uint8_t number_to_display;
  uint8_t number_length=strlen(number_str.c_str());
  uint8_t x_pos=(200-40*(number_length+1))/2;

  paint.SetWidth(200);
  paint.SetHeight(48);
  paint.Clear(UNCOLORED);
  epd.SetFrameMemoryPartial(paint.GetImage(), 0, 96, 200, 48);

  for(i=0;i<strlen(number_str.c_str());i++){
    number_to_display=std::stoi(std::to_string(number_str[i]-'0'));
    drawBitmap(x_pos+40*i, 96, 40, 48, &Font48_Table[number_to_display*240]);
  }
  drawBitmap(x_pos+40*number_length, 96, 40, 48, LETTER_h);
}

void displayFirstScreen(uint8_t hours){
  displayTimeChoice();
  displayTimeChoiceValue(hours);
  epd.DisplayPartFrame();
  epd.WaitUntilIdle();
}

void displayMainScreen(uint8_t BPM, uint8_t hours_left, uint8_t minutes_left, battery_level batteryState, bool bluetoothState){
  displayBattery(batteryState);
  if(bluetoothState == 1){
      displayBluetooth();
  }
  displayBPM(BPM);
  displayTimeLeft(hours_left,minutes_left);
  epd.DisplayPartFrame();
}

void wakeUpDisplay(){
  epd.LDirInit();
  epd.Clear();
}

void updateBPM(uint8_t BPM){
  displayBPMValue(BPM);
  epd.DisplayPartFrame();
}

void updateTimeChoice(uint8_t hours){
  displayTimeChoiceValue(hours);
  epd.DisplayPartFrame();
}

void splitText(const char* message){
  char message1[19];
  char message2[19];
  int splitPosition, maxCharsInLine=18;

  for(int i=maxCharsInLine;i>=0;i--){
    if(message[i]==' '){
      splitPosition=i;
      break;
    }
  }

  strncpy(message1,message,splitPosition);
  message1[splitPosition]='\0';
  //Serial.println(message1);
  strncpy(message2,message + splitPosition + 1,strlen(message)-splitPosition);
  //Serial.println(message2);

  uint8_t x_pos1=(200-strlen(message1)*11)/2;

  paint.SetWidth(200);
  paint.SetHeight(24);

  paint.Clear(COLORED);
  paint.DrawStringAt(x_pos1, 5, message1, &Font16, UNCOLORED);
  epd.SetFrameMemoryPartial(paint.GetImage(), 0, 152, paint.GetWidth(), paint.GetHeight());

  uint8_t x_pos2=(200-strlen(message2)*11)/2;

  paint.SetWidth(200);
  paint.SetHeight(24);

  paint.Clear(COLORED);
  paint.DrawStringAt(x_pos2, 5, message2, &Font16, UNCOLORED);
  epd.SetFrameMemoryPartial(paint.GetImage(), 0, 176, paint.GetWidth(), paint.GetHeight());
  }

void displayWarningPopUp(const char* message){
  drawBitmap(36, 17, 128, 112, WARNING);

  int maxCharsInLine=18;
  
  if(strlen(message)>maxCharsInLine){
    splitText(message);
  }
  else{
    uint8_t x_pos=(200-strlen(message)*11)/2;

    paint.SetWidth(200);
    paint.SetHeight(24);

    paint.Clear(COLORED);
    paint.DrawStringAt(x_pos, 5, message, &Font16, UNCOLORED);
    epd.SetFrameMemoryPartial(paint.GetImage(), 0, 176, paint.GetWidth(), paint.GetHeight());
  }


  epd.DisplayPartFrame();
}

void displayEndScreen(){
  std::string message1="Test has ended";
  std::string message2="You can see";
  std::string message3="first results in the mobile app";
  drawBitmap(52, 30, 96, 96, CHECK_MARK);

  uint8_t x_pos1=(200-strlen(message1.c_str())*11)/2;
  uint8_t x_pos2=(200-strlen(message2.c_str())*11)/2;

  paint.SetWidth(200);
  paint.SetHeight(24);

  paint.Clear(COLORED);
  paint.DrawStringAt(x_pos1, 5, message1.c_str(), &Font16, UNCOLORED);
  epd.SetFrameMemoryPartial(paint.GetImage(), 0, 0, paint.GetWidth(), paint.GetHeight());

  paint.SetWidth(200);
  paint.SetHeight(24);

  paint.Clear(COLORED);
  paint.DrawStringAt(x_pos2, 5, message2.c_str(), &Font16, UNCOLORED);
  epd.SetFrameMemoryPartial(paint.GetImage(), 0, 128, paint.GetWidth(), paint.GetHeight());

  splitText(message3.c_str());
  epd.DisplayPartFrame(); 
}
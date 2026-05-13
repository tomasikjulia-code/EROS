//////////////////////////////////////////////////////////////////////////////////////////
//
//   Arduino Library for ADS1292R Shield/Breakout
//
//   Copyright (c) 2017 ProtoCentral
//
//   This software is licensed under the MIT License(http://opensource.org/licenses/MIT).
//
//   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
//   NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
//   IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
//   WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
//   SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//
//   Requires g4p_control graphing library for processing.  Built on V4.1
//   Downloaded from Processing IDE Sketch->Import Library->Add Library->G4P Install
//
/////////////////////////////////////////////////////////////////////////////////////////
#include "Arduino.h"
#include "protocentralAds1292r.h"
#include <SPI.h>

int j,i;

volatile byte SPI_RX_Buff[15] ;
volatile static int SPI_RX_Buff_Count = 0;
volatile char *SPI_RX_Buff_Ptr;
volatile bool ads1292dataReceived = false;

unsigned long uecgtemp = 0;
unsigned long resultTemp = 0;

signed long secgtemp = 0;

long statusByte=0;

uint8_t LeadStatus=0;

boolean ads1292r::getAds1292EcgAndRespirationSamples(const int dataReady,const int chipSelect,ads1292OutputValues *ecgRespirationValues)
{

  if ((digitalRead(dataReady)) == LOW)      
  {
    SPI_RX_Buff_Ptr = ads1292ReadData(chipSelect); 

    for (int i = 0; i < 9; i++)
    {
      SPI_RX_Buff[SPI_RX_Buff_Count++] = *(SPI_RX_Buff_Ptr + i);  
    }

    ads1292dataReceived = true;
    j = 0;

    for (i = 3; i < 9; i += 3)         
    {
      uecgtemp = (unsigned long) (  ((unsigned long)SPI_RX_Buff[i + 0] << 16) | ( (unsigned long) SPI_RX_Buff[i + 1] << 8) |  (unsigned long) SPI_RX_Buff[i + 2]);
      uecgtemp = (unsigned long) (uecgtemp << 8);
      secgtemp = (signed long) (uecgtemp);
      secgtemp = (signed long) (secgtemp >> 8);

      (ecgRespirationValues->sDaqVals)[j++] = secgtemp; 
    }

    resultTemp = (uint32_t)((0 << 24) | (SPI_RX_Buff[3] << 16)| SPI_RX_Buff[4] << 8 | SPI_RX_Buff[5]);
    resultTemp = (uint32_t)(resultTemp << 8);
    ecgRespirationValues->sresultTempResp = (long)(resultTemp);


   uint8_t statusByte0 = SPI_RX_Buff[0];
   uint8_t loff_stat = statusByte0 & 0x06;

   if (loff_stat > 0) {
    ecgRespirationValues->leadoffDetected = true;
   } else {
    ecgRespirationValues->leadoffDetected = false;
   }

   ads1292dataReceived = false;
   SPI_RX_Buff_Count = 0;
   return true;
  }

  else
    return false;
}

char* ads1292r::ads1292ReadData(const int chipSelect)
{
  static char SPI_Dummy_Buff[10];
  digitalWrite(chipSelect, LOW);

  for (int i = 0; i < 9; ++i)
  {
    SPI_Dummy_Buff[i] = _spi.transfer(CONFIG_SPI_MASTER_DUMMY);
  }
  digitalWrite(chipSelect, HIGH);
  return SPI_Dummy_Buff;
}

void ads1292r::ads1292Init(const int chipSelect, const int pwdnPin, const int startPin)
{
  ads1292Reset(pwdnPin);
  delay(100);
  ads1292DisableStart(startPin);
  ads1292EnableStart(startPin);
  ads1292HardStop(startPin);
  ads1292StartDataConvCommand(chipSelect);
  ads1292SoftStop(chipSelect);
  delay(50);
  ads1292StopReadDataContinuous(chipSelect);          
  delay(300);

  ads1292RegWrite(ADS1292_REG_CONFIG1, 0x01, chipSelect);    
  delay(10);

  ads1292RegWrite(ADS1292_REG_CONFIG2, 0b11110000, chipSelect);  
  delay(10);

  ads1292RegWrite(ADS1292_REG_LOFF,0b00010000, chipSelect);   
  delay(10);

  ads1292RegWrite(ADS1292_REG_CH1SET, 0b10000001, chipSelect); 
  delay(10);

  ads1292RegWrite(ADS1292_REG_CH2SET, 0b01100000, chipSelect); 
  delay(10);

  ads1292RegWrite(ADS1292_REG_RLDSENS, 0b10110000, chipSelect);  
  delay(10);

  ads1292RegWrite(ADS1292_REG_LOFFSENS, 0x0C, chipSelect);   
  delay(10);                                          

  ads1292RegWrite(ADS1292_REG_RESP1, 0b00000010, chipSelect);    
  delay(10);

  ads1292RegWrite(ADS1292_REG_RESP2, 0b00000011, chipSelect);    
  delay(10);

  ads1292StartReadDataContinuous(chipSelect);
  delay(10);

  ads1292EnableStart(startPin);
}

void ads1292r::ads1292Reset(const int pwdnPin)
{
  digitalWrite(pwdnPin, HIGH);
  delay(100);					
  digitalWrite(pwdnPin, LOW);
  delay(100);
  digitalWrite(pwdnPin, HIGH);
  delay(100);
}

void ads1292r::ads1292DisableStart(const int startPin)
{
  digitalWrite(startPin, LOW);
  delay(20);
}

void ads1292r::ads1292EnableStart(const int startPin)
{
  digitalWrite(startPin, HIGH);
  delay(20);
}

void ads1292r::ads1292HardStop (const int startPin)
{
  digitalWrite(startPin, LOW);
  delay(100);
}

void ads1292r::ads1292StartDataConvCommand (const int chipSelect)
{
  ads1292SPICommandData(START,chipSelect);					
}

void ads1292r::ads1292SoftStop (const int chipSelect)
{
  ads1292SPICommandData(STOP,chipSelect);                  
}

void ads1292r::ads1292StartReadDataContinuous (const int chipSelect)
{
  ads1292SPICommandData(RDATAC,chipSelect);					
}

void ads1292r::ads1292StopReadDataContinuous (const int chipSelect)
{
  ads1292SPICommandData(SDATAC,chipSelect);					
}

void ads1292r::ads1292SPICommandData(unsigned char dataIn,const int chipSelect)
{
  byte data[1];

  digitalWrite(chipSelect, LOW);
  delay(2);
  digitalWrite(chipSelect, HIGH);
  delay(2);
  digitalWrite(chipSelect, LOW);
  delay(2);
  _spi.transfer(dataIn);
  delay(2);
  digitalWrite(chipSelect, HIGH);
}


void ads1292r::ads1292RegWrite (unsigned char READ_WRITE_ADDRESS, unsigned char DATA,const int chipSelect)
{

  // switch (READ_WRITE_ADDRESS)
  // {
  //   case 1:
  //           DATA = DATA & 0x87;
	//           break;
  //   case 2:
  //           DATA = DATA & 0xFB;
	//           DATA |= 0x80;
	//           break;
  //   case 3:
  //     	    DATA = DATA & 0xFD;
  //     	    DATA |= 0x10;
  //     	    break;
  //   case 7:
  //     	    DATA = DATA & 0x3F;
  //     	    break;
  //   case 8:
  //   	      DATA = DATA & 0x5F;
	//           break;
  //   case 9:
  //     	    DATA |= 0x02;
  //     	    break;
  //   case 10:
  //     	    DATA = DATA & 0x87;
  //     	    DATA |= 0x01;
  //     	    break;
  //   case 11:
  //     	    DATA = DATA & 0x0F;
  //     	    break;
  //   default:
  //           break;
  // }
  // now combine the register address and the command into one byte:
  byte dataToSend = READ_WRITE_ADDRESS | WREG;

  digitalWrite(chipSelect, LOW);
  delay(2);
  _spi.transfer(dataToSend); 
  _spi.transfer(0x00);		
  _spi.transfer(DATA);		
  delay(2);

  digitalWrite(chipSelect, HIGH);
}

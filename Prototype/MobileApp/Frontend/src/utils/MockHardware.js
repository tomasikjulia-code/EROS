///////// TEN PLIK JEST TYMCZASOWY - DO TESTOW WYKRESU I BUFORA /////
///////// CZESC DO DODANIA W PLIKU Z OBSLUGA BLUETOOTH, ABY ZINTEGROWAC: /////////
// import { ecgBuffer } from '../utils/EcgBuffer';

// // Gdy nadejdą dane z ESP32:
// bluetooth.on('data', (esp32Value) => {
//   // Parsujesz wartość i wrzucasz do bufora:
//   const numericValue = parseInt(esp32Value, 10);
//   ecgBuffer.pushData(numericValue); 
// });

import { ecgBuffer } from './EcgBuffer';

class MockHardware {
  constructor() {
    this.intervalId = null;
    this.tick = 0;
  }

  start() {
    if (this.intervalId) return;

    this.intervalId = setInterval(() => {
      this.tick++;
      
      let value = Math.random() * 600 - 300; 
      
      const cycle = this.tick % 250;
      
      if (cycle > 20 && cycle < 40) value += 1000 * Math.sin((cycle - 20) * Math.PI / 20); 
      else if (cycle === 50) value -= 2000;  
      else if (cycle === 53) value += 7800;  
      else if (cycle === 56) value -= 6500;  
      else if (cycle > 90 && cycle < 130) value += 2000 * Math.sin((cycle - 90) * Math.PI / 40); 

      if (this.tick % 1000 > 750) {
          if (cycle === 50) value -= 3000;
          else if (cycle === 55) value += 12000; 
          else if (cycle === 65) value -= 9000;  
          else if (cycle > 90 && cycle < 140) value -= 3000 * Math.sin((cycle - 90) * Math.PI / 50); 
      }

      ecgBuffer.pushData(value);

    }, 4); 
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

export const mockHardware = new MockHardware();
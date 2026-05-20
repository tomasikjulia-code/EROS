class CircularEcgBuffer {
  constructor(size = 150) {
    this.size = size;
    this.buffer = new Float32Array(size); 
    this.head = 0; 
  }

  /**
   * Nadpisujemy dane w miejscu wskaźnika i przesuwamy go o 1.
   * Modulo (%) sprawia, że gdy dojdziemy do końca (150), wskaźnik wraca na 0.
   */
  pushData(incomingData) {
    if (Array.isArray(incomingData)) {
      for (let i = 0; i < incomingData.length; i++) {
        this.buffer[this.head] = incomingData[i];
        this.head = (this.head + 1) % this.size;
      }
    } else {
      this.buffer[this.head] = incomingData;
      this.head = (this.head + 1) % this.size;
    }
  }

  /**
   * Zwraca klatkę dla Reacta.
   * Ponieważ nasz 'head' kręci się w kółko, musimy "wyprostować" tablicę
   * tak, aby najstarsze punkty były na początku, a najnowsze na końcu wykresu.
   */
  getSnapshot() {
    const snapshot = new Array(this.size);
    for (let i = 0; i < this.size; i++) {
      // Zaczynamy od 'head' (najstarszy nadpisany punkt) i idziemy w prawo
      snapshot[i] = this.buffer[(this.head + i) % this.size];
    }
    
    return snapshot;
  }
  
  clear() {
    this.buffer.fill(0);
    this.head = 0;
  }
}

export const ecgBuffer = new CircularEcgBuffer(1000);
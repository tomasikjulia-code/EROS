#include "CsvWriter.h"

CsvWriter::CsvWriter() {}

bool CsvWriter::begin(const char* path) {
    if (SD.exists(path)) {
        SD.remove(path); 
    }

    _file = SD.open(path, FILE_WRITE);
    if (!_file) return false;

    _file.println("Timestamp_ms,EKG_Raw,BPM,LeadOff,Activity");
    _file.flush();
    
    _recording = true;
    return true;
}

void CsvWriter::writeBuffer(const Sample* samples, size_t count) {
    if (!_recording || samples == nullptr || count == 0) return;

    // Przechodzimy przez tablicę struktur i formatujemy je do formatu CSV
    for (size_t i = 0; i < count; i++) {
        _file.print(samples[i].timestamp);
        _file.print(",");
        _file.print(samples[i].rawValue);
        _file.print(",");
        _file.print(samples[i].bpm);
        _file.print(",");
        _file.print(samples[i].leadOff ? "1" : "0");
        _file.print(",");
        
        if (samples[i].activity < 0) {
            _file.print("B"); 
        } else {
            _file.print(samples[i].activity, 2);
        }
        
        _file.print(",");
        _file.println(samples[i].important);
    }

    // Wymuszamy zapis całego bloku na kartę SD
    // Przy zapisie blokowym warto robić flush() rzadziej, 
    // bo samo zamknięcie bufora w bibliotece FS i tak nastąpi automatycznie.
    _file.flush(); 
}

void CsvWriter::writeSample(uint32_t millisy, uint16_t rawValue, int bpm, bool leadOff, float activity, int important) {
    if (!_recording) return;

    _file.print(millisy);
    _file.print(",");
    _file.print(rawValue);
    _file.print(",");
    _file.print(bpm);
    _file.print(",");
    _file.print(leadOff ? "1" : "0");
    _file.print(",");
    if (activity < 0) {
        _file.print("B"); // Zapisz 'B' jeśli nie ma nowego pomiaru
    } else {
        _file.print(activity, 2); // Zapisz liczbę z 2 miejscami po przecinku
    }
    _file.print(",");
    _file.println(important);

    static int syncCounter = 0;
    if (++syncCounter >= 64) {
        _file.flush(); 
        syncCounter = 0;
    }
}

void CsvWriter::closeFile() {
    if (!_recording) return;
    _file.flush(); 
    _file.close();
    _recording = false;
}
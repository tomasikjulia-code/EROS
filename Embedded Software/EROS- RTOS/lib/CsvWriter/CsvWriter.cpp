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

void CsvWriter::writeSample(int16_t rawValue, int bpm, bool leadOff, float activity, int important) {
    if (!_recording) return;
    
    _file.print(millis());
    _file.print(",");
    _file.print(rawValue);
    _file.print(",");
    _file.print(bpm);
    _file.print(",");
    _file.print(leadOff ? "1" : "0");
    _file.print(",");
    if (activity < 0) {
        _file.print("b"); // Zapisz 'b' jeśli nie ma nowego pomiaru
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
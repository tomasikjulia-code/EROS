#include "CsvWriter.h"

CsvWriter::CsvWriter() {}

bool CsvWriter::begin(const char* path) {
    if (SD.exists(path)) {
        SD.remove(path); 
    }

    _file = SD.open(path, FILE_WRITE);
    if (!_file) return false;

    _file.println("Timestamp_ms,EKG_Raw,BPM,LeadOff");
    _file.flush();
    
    _recording = true;
    return true;
}

void CsvWriter::writeSample(int16_t rawValue, int bpm, bool leadOff) {
    if (!_recording) return;
    
    _file.print(millis());
    _file.print(",");
    _file.print(rawValue);
    _file.print(",");
    _file.print(bpm);
    _file.print(",");
    _file.println(leadOff ? "1" : "0");

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
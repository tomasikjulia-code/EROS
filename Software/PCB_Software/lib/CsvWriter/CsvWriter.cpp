#include "CsvWriter.h"

CsvWriter::CsvWriter() {
    _path[0] = '\0';
    _flushCounter = 0;
}

bool CsvWriter::begin(const char* path) {
    if (SD.exists(path)) {
        SD.remove(path); 
    }
    _file = SD.open(path, FILE_APPEND);
    if (!_file) return false;
    strncpy(_path, path, sizeof(_path) - 1);
    _path[sizeof(_path) - 1] = '\0';

    _file.println("Timestamp_ms,EKG_Raw,BPM,LeadOff,Activity,Important");
    _file.flush();

    _recording = true;
    return true;
}

void CsvWriter::writeBuffer(const Sample* samples, size_t count) {
    if (!_recording || samples == nullptr || count == 0) return;

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
    if (++_flushCounter >= 8) {
        _file.flush();
        _flushCounter = 0;
    }
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
        _file.print("B"); 
    } else {
        _file.print(activity, 2); 
    }
    _file.print(",");
    _file.println(important);

    static int syncCounter = 0;
    if (++syncCounter >= 64) {
        _file.flush(); 
        syncCounter = 0;
    }
}

uint32_t CsvWriter::getFileSize() {
    _file.flush();
    return _file.size();
}

bool CsvWriter::openReadSession() {
    _file.flush();

    if (_readFile) {
        _readFile.close();
    }

    _readFile = SD.open(_path, FILE_READ);

    if (!_readFile) {
        Serial.println("[CSV] FAILED TO OPEN READ FILE");
        return false;
    }

    Serial.printf(
        "[CSV] Read session opened. Size=%lu\n",
        (unsigned long)_readFile.size()
    );

    return true;
}

void CsvWriter::closeReadSession() {

    if (_readFile) {
        _readFile.close();
    }
}

size_t CsvWriter::readAt(uint32_t pos, uint8_t* buf, size_t bufSize) {

    if (!_readFile) {
        Serial.println("[CSV] readAt: invalid read handle");
        return 0;
    }

    if (!_readFile.seek(pos)) {
        Serial.printf("[CSV] SEEK FAILED pos=%lu\n", pos);
        return 0;
    }

    return _readFile.read(buf, bufSize);
}

void CsvWriter::closeFile() {
    if (!_recording) return;
    _file.flush(); 
    _file.close();
    _recording = false;
}
#ifndef CSV_WRITER_H
#define CSV_WRITER_H

#include <Arduino.h>
#include <FS.h>
#include <SD.h>

typedef struct{
    uint32_t timestamp;
    int16_t rawValue;
    int bpm;
    bool leadOff;
    float activity;
    int important; // dodatkowe pole do zapisu ważnych zdarzeń, np. naciśnięcie przycisku
} Sample;

class CsvWriter {
public:

    CsvWriter();
    bool begin(const char* path);
    void writeSample(int16_t rawValue, int bpm, bool leadOff, float activity, int important);
    void closeFile();
    bool isRecording() { return _recording; }
    void writeBuffer(const Sample* samples, size_t count);
    
private:
    File _file;
    bool _recording = false;
};

#endif
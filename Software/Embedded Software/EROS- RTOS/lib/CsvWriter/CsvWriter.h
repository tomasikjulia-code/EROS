#ifndef CSV_WRITER_H
#define CSV_WRITER_H

#include <Arduino.h>
#include <FS.h>
#include <SD.h>

class CsvWriter {
public:
    CsvWriter();
    bool begin(const char* path);
    void writeSample(int16_t rawValue, int bpm, bool leadOff, float activity, int important);
    void closeFile();
    bool isRecording() { return _recording; }

private:
    File _file;
    bool _recording = false;
};

#endif
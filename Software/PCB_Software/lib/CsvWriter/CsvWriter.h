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
    int important; 
} Sample;

class CsvWriter {
public:

    CsvWriter();
    bool begin(const char* path);
    void writeSample(uint32_t millisy, uint16_t rawValue, int bpm, bool leadOff, float activity, int important);
    void closeFile();
    bool openReadSession();
    void closeReadSession();
    bool isRecording() { return _recording; }
    void writeBuffer(const Sample* samples, size_t count);

    uint32_t getFileSize();
    size_t readAt(uint32_t pos, uint8_t* buf, size_t bufSize);
    
private:
    File _file;
    File _readFile;
    bool _recording = false;
    char _path[64];
    int _flushCounter;
};

#endif
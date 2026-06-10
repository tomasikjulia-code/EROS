#ifndef CSV_WRITER_H
#define CSV_WRITER_H

#include <Arduino.h>
#include <FS.h>
#include <SD.h>
#define MAX_BUFFER_SIZE 10240 // 10 KB


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
    bool isRecording() { return _recording; }
    void writeBuffer(const Sample* samples, size_t count, SemaphoreHandle_t sdMutex);

    uint32_t getFileSize() const;

    static char _writeBuf[MAX_BUFFER_SIZE]; // Stały bufor pamięci do zapisu na kartę SD
    uint32_t _writeCounter;//licznik zapiosow buforow do sprawdzania kiedy zrobic flush
    
private:
    File _file;
    bool _recording = false;
};

#endif
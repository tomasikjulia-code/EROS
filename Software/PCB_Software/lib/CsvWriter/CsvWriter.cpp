#include "CsvWriter.h"

//ZMIENNE STATYCZNE
char CsvWriter::_writeBuf[MAX_BUFFER_SIZE];

CsvWriter::CsvWriter() {}

bool CsvWriter::begin(const char* path) {

    if (SD.exists(path)) {
        SD.remove(path); 
    }

    _file = SD.open(path, FILE_APPEND);
    if (!_file) return false;

    _file.println("Timestamp_ms,EKG_Raw,BPM,LeadOff,Activity,Important");
    _file.flush();

    _recording = true;
    return true;
}

void CsvWriter::writeBuffer(const Sample* samples, size_t count, SemaphoreHandle_t sdMutex) {
    // Zabezpieczenie przed błędem alokacji
    if (!_recording || samples == nullptr || count == 0 || _writeBuf == nullptr) return;

    size_t offset = 0;
    
    // Formatowanie wprost do stałego bufora (bardzo szybkie!)
    for (size_t i = 0; i < count; i++) {
        char activityStr[16];
        if (samples[i].activity < 0) {
            strcpy(activityStr, "B");
        } else {
            dtostrf(samples[i].activity, 0, 2, activityStr);
        }

        int written = snprintf(_writeBuf + offset, MAX_BUFFER_SIZE - offset, 
                               "%lu,%d,%d,%d,%s,%d\n",
                               samples[i].timestamp,
                               samples[i].rawValue,
                               samples[i].bpm,
                               samples[i].leadOff ? 1 : 0,
                               activityStr,
                               samples[i].important);

        if (written > 0 && written < (MAX_BUFFER_SIZE - offset)) {
            offset += written;
        } else {
            break; 
        }
    }

    if (offset > 0) {
        if (xSemaphoreTake(sdMutex, portMAX_DELAY) == pdTRUE) {
            
            _file.write((const uint8_t*)_writeBuf, offset);

            //printf("Wolna pamiec: %lu\n", esp_get_free_heap_size());

            _writeCounter++;
            if (_writeCounter % 4 == 0) {
                _file.flush();
            }
            //logika przełączania plikow po 3 minutach badania
            if (_writeCounter %225 == 0) { // co rowne 3 min badania zmieniam plik
                _file.flush();
                fullFileSize += _file.size();
                _file.close();
                char newFileName[32];
                _fileCounter ++;
                //Serial.printf(">>> Zmieniam plik na: test_ekg_%d.csv <<<\n", _fileCounter);
                snprintf(newFileName, sizeof(newFileName), "/test_ekg_%d.csv", _fileCounter);
                begin(newFileName);
                
            }

            xSemaphoreGive(sdMutex);
        }
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
uint32_t CsvWriter::getFileSize() const {
    if (!_recording){
        File temp = SD.open("/test_ekg.csv", FILE_READ);
        return temp.size();
    }else return _file.size();
}

void CsvWriter::closeFile() {
    if (!_recording) return;
    _file.flush(); 
    fullFileSize += _file.size();
    _file.close();
    _recording = false;
}
import React, { useState, useRef, useEffect } from 'react';
import { ScrollView, Animated, View, Text, TouchableOpacity, StatusBar, Platform, PermissionsAndroid } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { AlertCircle, CheckCircle2, Home, History, Settings } from 'lucide-react-native';
import { styles } from './src/constants/Theme';
import { initialHistory, generateHourlyTrend, generateMockEcgStrip } from './src/utils/Generators';
import { requestBluetoothPermissions, getPairedDevices, connectToDevice, disconnectDevice, receiveData, sendData } from './src/utils/BluetoothSerial';

import HomeScreen from './src/screens/HomeScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import ReportScreen from './src/screens/ReportScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { ecgBuffer } from './src/utils/EcgBuffer.js'
import { parseEcgFileToTrend } from './src/utils/CsvParser';

import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';

import * as Sharing from 'expo-sharing';
import RNFS from 'react-native-fs';

let Speech;
try {
  Speech = require('expo-speech');
} catch (e) {
  Speech = null;
}

const analyzeEcgTrend = (parsedTrend) => {
  let minBpm = 999, maxBpm = 0, sumBpm = 0, validBpmCount = 0;
  let minBpmTimeMs = 0, maxBpmTimeMs = 0;
  
  let tachyDetails = []; 
  let bradyDetails = []; 
  
  let isCurrentlyTachy = false;
  let tachyStartTime = 0;
  let lastTachyEndTime = 0;
  
  let isCurrentlyBrady = false;
  let bradyStartTime = 0;
  let lastBradyEndTime = 0;
  
  const MIN_TIME_MS = 30000;       
  const MERGE_THRESHOLD_MS = 60000; 
  
  const TACHY_THRESHOLD = 100;
  const TACHY_STOP_THRESHOLD = 90;
  
  const BRADY_THRESHOLD = 50; // Zaczynamy epizod poniżej 50
  const BRADY_STOP_THRESHOLD = 55; // Kończymy powyżej 55

  const IGNORE_FIRST_MS = 60000; 

  const cleanData = parsedTrend.filter(p => p.bpm >= 35 && p.bpm <= 220 && !p.isNoise);

  for (let i = 0; i < cleanData.length; i++) {
    const point = cleanData[i];
    const bpm = point.bpm;
    const timeMs = point.timeMs;

    // Pomijamy szumy z pierwszych 60 sekund badania
    if (timeMs < IGNORE_FIRST_MS) continue;

    // Statystyki ogólne Min/Max
    if (bpm < minBpm){ minBpm = bpm; minBpmTimeMs = timeMs; }
    if (bpm > maxBpm){ maxBpm = bpm; maxBpmTimeMs = timeMs; }
    sumBpm += bpm;
    validBpmCount++;

    // --- TACHYKARDIA ---
    if (!isCurrentlyTachy) {
      if (bpm >= TACHY_THRESHOLD) {
        if (tachyStartTime === 0) tachyStartTime = timeMs;
        if (timeMs - tachyStartTime >= MIN_TIME_MS) {
          if (tachyStartTime - lastTachyEndTime > MERGE_THRESHOLD_MS || lastTachyEndTime === 0) {
            tachyDetails.push({ start: tachyStartTime, end: 0, maxBpm: bpm });
          }
          isCurrentlyTachy = true;
        }
      } else {
        tachyStartTime = 0;
      }
    } else {
      let currentIdx = tachyDetails.length - 1;
      if (bpm > tachyDetails[currentIdx].maxBpm) tachyDetails[currentIdx].maxBpm = bpm;

      if (bpm < TACHY_STOP_THRESHOLD) {
        isCurrentlyTachy = false;
        lastTachyEndTime = timeMs;
        tachyDetails[tachyDetails.length - 1].end = timeMs;
        tachyStartTime = 0;
      }
    }

    // --- BRADYKARDIA ---
    if (!isCurrentlyBrady) {
      if (bpm <= BRADY_THRESHOLD) {
        if (bradyStartTime === 0) bradyStartTime = timeMs;
        if (timeMs - bradyStartTime >= MIN_TIME_MS) {
          if (bradyStartTime - lastBradyEndTime > MERGE_THRESHOLD_MS || lastBradyEndTime === 0) {
            bradyDetails.push({ start: bradyStartTime, end: 0, minBpm: bpm });
          }
          isCurrentlyBrady = true;
        }
      } else {
        bradyStartTime = 0;
      }
    } else {
      let currentIdx = bradyDetails.length - 1;
      // Podczas bradykardii szukamy "dna", czyli najniższej wartości
      if (bpm < bradyDetails[currentIdx].minBpm) bradyDetails[currentIdx].minBpm = bpm;

      if (bpm > BRADY_STOP_THRESHOLD) {
        isCurrentlyBrady = false;
        lastBradyEndTime = timeMs;
        bradyDetails[bradyDetails.length - 1].end = timeMs;
        bradyStartTime = 0;
      }
    }
  }

  if (isCurrentlyTachy && tachyDetails.length > 0) tachyDetails[tachyDetails.length - 1].end = cleanData[cleanData.length - 1].timeMs;
  if (isCurrentlyBrady && bradyDetails.length > 0) bradyDetails[bradyDetails.length - 1].end = cleanData[cleanData.length - 1].timeMs;

  return {
    minBpm: minBpm === 999 ? 0 : Math.floor(minBpm),
    minBpmTimeMs: minBpmTimeMs,
    maxBpm: Math.ceil(maxBpm),
    maxBpmTimeMs: maxBpmTimeMs,
    avgBpm: validBpmCount > 0 ? Math.round(sumBpm / validBpmCount) : 0,
    tachyEpisodes: tachyDetails.length,
    tachyDetails: tachyDetails,
    bradyEpisodes: bradyDetails.length, 
    bradyDetails: bradyDetails,         
    arrhythmiaEvents: tachyDetails.length + bradyDetails.length 
  };
};

const formatMsToTime = (ms) => {
  if (!ms && ms !== 0) return "--:--:--";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const getEcgSlice = (trend, centerTimeMs, pointsToSide = 150) => {
  const fallbackLine = [0, 10, -10, 10, -10, 0]; 
  
  if (!trend || trend.length === 0 || centerTimeMs == null || isNaN(centerTimeMs)) {
    return fallbackLine; 
  }

  let closestIdx = 0;
  let minDiff = Infinity;
  
  for (let i = 0; i < trend.length; i++) {
    const diff = Math.abs(trend[i].timeMs - centerTimeMs);
    if (diff < minDiff) {
      minDiff = diff;
      closestIdx = i;
    }
  }

  const startIdx = Math.max(0, closestIdx - pointsToSide);
  const endIdx = Math.min(trend.length, closestIdx + pointsToSide);

  const slice = trend.slice(startIdx, endIdx).map(p => {
    let val = p.EKG_Raw;
    
    if (val === undefined && p.originalLine) {
       const parts = p.originalLine.split(',');
       val = parseInt(parts[1], 10); // wyciagamy samo ekg
    }

    return (val !== undefined && !isNaN(val)) ? val : 0; 
  });

  return slice.length > 2 ? slice : fallbackLine; 
};

const FILE_URI = FileSystem.documentDirectory + 'current_examination.csv';

export default function App() {
  const [view, setView] = useState('home');
  const [bleState, setBleState] = useState('disconnected');
  const [syncState, setSyncState] = useState('idle');

  const deviceRef = useRef(null);
  const subscriptionRef = useRef(null);
  const scrollViewRef = useRef(null);

  useEffect(() => {
    // Kiedy zmienia się 'view', przewiń na samą górę
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: 0, animated: false }); 
    }
  }, [view]);

  const [records, setRecords] = useState(initialHistory);
  const [deviceData, setDeviceData] = useState(null);

  const [diagnostics, setDiagnostics] = useState(null);

  const [activeReportRecord, setActiveReportRecord] = useState(null);
  const [aiReport, setAiReport] = useState(null);
  const [doctorEmail, setDoctorEmail] = useState('');

  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [isNotifEnabled, setIsNotifEnabled] = useState(true);
  const [isVibrateEnabled, setIsVibrateEnabled] = useState(true);

  const [toastMessage, setToastMessage] = useState(null);
  const toastAnim = useRef(new Animated.Value(200)).current;

  const [isLiveEcgActive, setIsLiveEcgActive] = useState(false);
  const [lastConnectedTime, setLastConnectedTime] = useState(null);

  const isReceivingFileRef = useRef(false);
  const readyResolveRef = useRef(null);
  const transferResolveRef = useRef(null);

  const fileBufferRef = useRef([]);
  const flushIntervalRef = useRef(null);
  const isFlushingRef = useRef(false);
  const fileWriteQueue = useRef(Promise.resolve());
  // useEffect(() => {
  //   flushIntervalRef.current = setInterval(() => {
  //     flushBuffer();
  //   }, 500); // every 500ms

  //   return () => {
  //     clearInterval(flushIntervalRef.current);
  //   };
  // }, []);

  const showToast = (message, type = 'success') => {
    setToastMessage({ message, type });
    Animated.spring(toastAnim, { toValue: 0, useNativeDriver: true, friction: 8 }).start();

    if (isVoiceEnabled && Speech) {
      Speech.stop();
      Speech.speak(message, { language: 'pl-PL', rate: 1.05 });
    }

    setTimeout(() => {
      Animated.timing(toastAnim, { toValue: 200, duration: 300, useNativeDriver: true }).start(() => setToastMessage(null));
    }, 3500);
  };

  const handleVoiceToggle = () => {
    const newState = !isVoiceEnabled;
    setIsVoiceEnabled(newState);
    if (newState) {
      if (Speech) { Speech.stop(); Speech.speak("Asystent głosowy został aktywowany.", { language: 'pl-PL' }); }
      showToast("Asystent głosowy został aktywowany.", "info");
    } else {
      if (Speech) Speech.stop();
      showToast("Asystent głosowy wyłączony.", "info");
    }
  };

  const toggleBluetooth = async () => {
    if (bleState === 'disconnected') {
      const hasPermissions = await requestBluetoothPermissions();
      if (!hasPermissions) {
        showToast("Brak uprawnień Bluetooth.", "error");
        return;
      }

      const paired = await getPairedDevices();
      const eros = paired.find(device => device.name === "EROS");
      if (!eros) {
        showToast("Nie znaleziono urządzenia. Sparuj je w ustawieniach telefonu.", "error");
        return;
      }

      const device = await connectToDevice(eros.address);
      if (!device) {
        showToast("Nie udało połączyć się z urządzeniem.", "error");
        return;
      }

      deviceRef.current = device;
      setBleState('connected');
      showToast('Nawiązano bezpieczne połączenie z EROS.');

      setIsLiveEcgActive(false);
      setLastConnectedTime(new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }));

      sendData(eros.address, "GET_STATE");
      subscriptionRef.current = receiveData(eros.address, (rawData) => {
        handleIncomingData(rawData);
      });

    } else {
      subscriptionRef.current?.remove();
      await disconnectDevice(deviceRef.current?.address);
      deviceRef.current = null;

      setBleState('disconnected');
      setSyncState('idle');
      showToast('Rozłączono urządzenie. Tryb odczytu lokalnego.', 'info');

      setIsLiveEcgActive(false);
    }
  };

  function handleIncomingData(rawData) {
    try {
      const trimmed = rawData.trim();
      //console.log(trimmed);
      if (!trimmed) return;

      if (trimmed === 'READY') {
        readyResolveRef.current?.();
        readyResolveRef.current = null;
        return;
      }

      if (trimmed.startsWith('E')) {
        const sample = parseEcgPacket(trimmed);
        ecgBuffer.pushData(sample);
        return;
      }

      if (trimmed.startsWith('D')) {
        parseDiagnostics(trimmed);
        return;
      }

      if (trimmed.startsWith('S')) {
        transferResolveRef.current?.();
        transferResolveRef.current = null;
        isReceivingFileRef.current = false;

        //flushBuffer();

        return;
      }

      if (isReceivingFileRef.current) {
        //const line=parseFilePacket(trimmed);
        //if(line && !isNaN(line.timestampMs)) writeToFile(line);
        writeToFile(trimmed);
      }

    } catch (e) {
      console.warn('Failed to parse data from EROS:', rawData);
    }
  }

  function parseEcgPacket(trimmed) {
    const sample = parseInt(trimmed.slice(1), 10);
    if (!isNaN(sample)) {
      return sample;
    }
  }

  function parseFilePacket(line) {
    const values = line.trim().split(',');

    return {
      timestampMs: parseInt(values[0]),
      ECGRaw: parseInt(values[1]),
      BPM: parseInt(values[2]),
      leadOff: parseInt(values[3]),
    }
  }

  function parseDiagnostics(trimmed) {
    const parsed = JSON.parse(trimmed.trim().slice(1));
    setDiagnostics({
      battery: parsed.battery,
      signalQuality: parsed.signalQuality,
      isMeasuring: parsed.isMeasuring,
      electrodes: Array.isArray(parsed.electrodes) ? parsed.electrodes : [],
    });
  }


  const handleToggleLiveEcg = () => {
    if (isLiveEcgActive) {
      if (bleState === 'connected' && deviceRef.current) sendData(deviceRef.current.address, "STOP");
      setIsLiveEcgActive(false);
    } else {
      if (bleState === 'connected' && deviceRef.current) sendData(deviceRef.current.address, "GET_ECG");
      setIsLiveEcgActive(true);
    }
  };

  const refreshDiagnostics = () => {
    if (bleState === 'connected' && deviceRef.current) {
      setSyncState('syncing');
      showToast('Odświeżam status urządzenia...', 'info');
      sendData(deviceRef.current.address, "GET_STATE");
      setTimeout(() => setSyncState('idle'), 1000);
    }
  };

  const getFileFromDevice = async () => {
    transferResolveRef.current=null;
    if (bleState !== 'connected') {
      showToast('Najpierw połącz urządzenie.', 'error');
      return;
    }

    setSyncState('syncing');

    const lastSavedTS = await getLastTimestampFromFile();
    console.log("Last timestamp found in file:", lastSavedTS);


    showToast('Pobieranie badania z Holtera...', 'info');

    try {

      const waitForReady = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timeout: Device not ready")), 5000);
        readyResolveRef.current = () => {
          clearTimeout(timeout);
          resolve();
        };
      });

      sendData(deviceRef.current.address, "GET_FILE");
      await waitForReady;

      await initFile();

      isReceivingFileRef.current = true;

      const transferComplete = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Error: Transfer timeout")), 300000);
        transferResolveRef.current = () => {
          clearTimeout(timeout);
          resolve();
        };
      });

      sendData(deviceRef.current.address, `OK${lastSavedTS}`);
      await transferComplete;
      await flushBuffer();

      //await fileWriteQueue.current; 
      
      console.log('All data safely on disk.');

      const finalCheck = await FileSystem.getInfoAsync(FILE_URI);
      console.log(`Final file size: ${finalCheck.size} bytes`);

      // // (Symulacja transferu pliku - do wywalenia potem)
      // await new Promise(resolve => setTimeout(resolve, 2000));
      // const [{ localUri }] = await Asset.loadAsync(require('./assets/test_ekg.csv'));
      // await FileSystem.copyAsync({ from: localUri, to: FILE_URI });

      showToast('Trwa analiza EKG...', 'info');

      const fileContent = await FileSystem.readAsStringAsync(FILE_URI, {
        encoding: FileSystem.EncodingType.UTF8
      });

      const parsedTrend = parseEcgFileToTrend(fileContent);

      if (!parsedTrend || parsedTrend.length === 0) {
        showToast('Błąd: Plik jest pusty lub uszkodzony.', 'error');
        setSyncState('idle');
        return;
      }

      const stats = analyzeEcgTrend(parsedTrend);
      const lastTimeMs = parsedTrend[parsedTrend.length - 1].timeMs;
      const durationMins = Math.floor(lastTimeMs / 60000);
      const durationSecs = Math.floor((lastTimeMs % 60000) / 1000);

      const newData = {
              id: Date.now().toString(),
              date: new Date().toISOString(),
              duration: `${durationMins}m ${durationSecs}s`,
              totalBeats: parsedTrend.length,
              avgBpm: stats.avgBpm,
              minBpm: stats.minBpm,
              minBpmTime: formatMsToTime(stats.minBpmTimeMs),
              minBpmTimeMs: stats.minBpmTimeMs, 
              maxBpm: stats.maxBpm,
              maxBpmTime: formatMsToTime(stats.maxBpmTimeMs),
              maxBpmTimeMs: stats.maxBpmTimeMs,
              tachyEpisodes: stats.tachyEpisodes,
              tachyDetails: stats.tachyDetails,
              bradyEpisodes: stats.bradyEpisodes,
              bradyDetails: stats.bradyDetails,
              arrhythmiaEvents: stats.arrhythmiaEvents, 
              veb: { total: 0, pairs: 0, runs: 0, burden: "0%" },
              sveb: { total: 0, pairs: 0, runs: 0, burden: "0%" },
              pauses: { count: 0, longest: "0", longestTime: "--" },
              hourlyTrend: parsedTrend
            };

      setDeviceData(newData);
      setRecords(prev => [newData, ...prev]);
      setSyncState('synced');
      setAiReport(null);
      showToast('Badanie odebrane i przeanalizowane!');
      //saveToDownloads(parsedTrend);

    } catch (error) {
      console.error("Błąd czytania pliku:", error);
      showToast('Wystąpił błąd podczas analizy pliku.', 'error');
      setSyncState('idle');
    }
  };

  const initFile = async () => {
    console.log("Initiating file");
    try {
      const fileInfo = await FileSystem.getInfoAsync(FILE_URI);
      if (!fileInfo.exists) {
        await FileSystem.writeAsStringAsync(
          FILE_URI,
          'Timestamp_ms,ECG_raw,BPM,Lead_off,Activity\n',
          { encoding: FileSystem.EncodingType.UTF8 }
        );
      }
    } catch (error) {
      console.error('Failed to initiate writing to file:', error);
    }
  }

  const writeToFile = (data) => {
    try {
      //console.log(data);
      //const row = `${timestampMs},${ECGRaw},${BPM},${leadOff}\n`
      // await FileSystem.writeAsStringAsync(FILE_URI, data+"\n", {
      //   encoding: FileSystem.EncodingType.UTF8,
      //   append: true,
      // });
      //console.log('Received data packet:', data.trim());
      fileBufferRef.current.push(data + '\n');
      //console.log(`Buffer size: ${fileBufferRef.current.length}`);

      if (fileBufferRef.current.length > 4000 && !isFlushingRef.current) {
        flushBuffer();
      }
    } catch (error) {
      console.error('Failed to write to file:', error);
    }
  }

  const flushBuffer = async () => {
    console.log('Starting flushing...');
    if (fileBufferRef.current.length === 0) return fileWriteQueue.current;

    const dataToWrite = fileBufferRef.current.join('');
    fileBufferRef.current = [];

    const rnfsPath = FILE_URI.replace('file://', '');

    // Chain the next write to the end of the previous one
    fileWriteQueue.current = fileWriteQueue.current.then(async () => {
      try {
        await RNFS.appendFile(FILE_URI, dataToWrite, 'utf8');
        console.log('Flush success');
      } catch (error) {
        console.error('Flush failed:', error);
      }
    });
  
  return fileWriteQueue.current; 
  };

  const getLastTimestampFromFile = async () => {
    try {
      const fileInfo = await FileSystem.getInfoAsync(FILE_URI);
      if (!fileInfo.exists) return "0";

      const content = await FileSystem.readAsStringAsync(FILE_URI);
      const lines = content.trim().split('\n');

      if (lines.length <= 1) return "0";

      const lastLine = lines[lines.length - 1];
      const parts = lastLine.split(',');

      return parts[0] || "0";
    } catch (e) {
      console.error("Error reading last timestamp:", e);
      return "0";
    }
  }

const openReport = (record) => {
  if (!record) return;
  setActiveReportRecord(record);

  const snippets = [
    { 
      title: "Maksymalne Tętno", 
      description: `Szczyt wysiłku lub arytmii.`, 
      time: record.maxBpmTime, 
      hr: record.maxBpm, 
      data: getEcgSlice(record.hourlyTrend, record.maxBpmTimeMs, 600)
    },
    { 
      title: "Minimalne Tętno", 
      description: `Najniższy zarejestrowany rytm.`, 
      time: record.minBpmTime, 
      hr: record.minBpm, 
      data: getEcgSlice(record.hourlyTrend, record.minBpmTimeMs, 600)
    }
  ];

  const tachyList = record.tachyDetails || [];
  tachyList.slice(0, 3).forEach((ep, index) => { // limit wykresow tachykardii ustawiony na 3
    const duration = (ep.end && ep.end > ep.start) ? (ep.end - ep.start) : 0;
    const centerTime = ep.start + duration / 2;

    snippets.push({
      title: `Epizod Tachykardii #${index + 1}`,
      description: `Czas trwania: ${Math.round(duration / 1000)}s`,
      time: formatMsToTime(ep.start),
      hr: ep.maxBpm,
      data: getEcgSlice(record.hourlyTrend, centerTime, 600) 
    });
  });

  const bradyList = record.bradyDetails || [];
  bradyList.slice(0, 3).forEach((ep, index) => { // limit wykresow bradykardii ustawiony na 3
    const duration = (ep.end && ep.end > ep.start) ? (ep.end - ep.start) : 0;
    const centerTime = ep.start + duration / 2;

    snippets.push({
      title: `Epizod Bradykardii #${index + 1}`,
      description: `Czas trwania: ${Math.round(duration / 1000)}s`,
      time: formatMsToTime(ep.start),
      hr: ep.minBpm, 
      data: getEcgSlice(record.hourlyTrend, centerTime, 600)
    });
  });

  const tachyFinding = tachyList.length > 0 
    ? `Wykryto ${tachyList.length} istotnych epizodów tachykardii (>100 BPM).` 
    : "Nie wykryto istotnych epizodów tachykardii.";

  const bradyFinding = bradyList.length > 0 
    ? `Wykryto ${bradyList.length} epizodów bradykardii (<50 BPM).` 
    : "Nie wykryto istotnych epizodów bradykardii.";

  setAiReport({
      date: new Date(record.date).toLocaleDateString('pl-PL'),
      summary: `Przeanalizowano zapis EKG trwający ${record.duration}.`,
      findings: [
        `Tętno: Max ${record.maxBpm} BPM (${record.maxBpmTime}), Min ${record.minBpm} BPM (${record.minBpmTime}).`,
        tachyFinding,
        bradyFinding, 
        `Pauzy: Brak przerw > 2.0s.`
      ],
      recommendation: (tachyList.length > 3 || bradyList.length > 3) 
        ? "Wykryto znaczną liczbę epizodów arytmicznych. Bezwzględnie zalecana jest pilna konsultacja kardiologiczna. Pamiętaj: ta analiza to wyłącznie screening algorytmiczny, nie diagnoza medyczna." 
        : "Algorytm nie wykrył istotnych, groźnych nieprawidłowości w badanym okresie. UWAGA: Raport wygenerowany przez AI ma wyłącznie charakter informacyjny i nie zastępuje profesjonalnej diagnozy lekarskiej. Zawsze konsultuj swoje wyniki ze specjalistą.",
      snippets: snippets, 
      tachyDetails: tachyList,
      bradyDetails: bradyList 
    });

  setView('report');
};

  const buildNoiseCsvContent = (trendData) => {
    if (!trendData || trendData.length === 0) return '';
    
    const header = 'Timestamp_ms,ECG_raw,BPM,Lead_off,Activity,Important,Noise\n';
    const body = trendData.map(t => `${t.originalLine},${t.isNoise ? 1 : 0}`).join('\n');
    return header + body;
  };

const saveToDownloads = async (trendData) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    try {
      if (!trendData || trendData.length === 0) {
        showToast('Brak danych do udostępnienia.', 'error');
        return;
      }

      const uniqueId = Date.now();
      // zmienilam na cache zeby nie zasmiecac telefonu
      const EXPORT_URI = FileSystem.cacheDirectory + `badanie_EKG_${uniqueId}.csv`;
      
      console.log(`Generowanie pliku wyjściowego z ${trendData.length} rekordami...`);

      const finalCsvString = buildNoiseCsvContent(trendData);
      
      await FileSystem.writeAsStringAsync(EXPORT_URI, finalCsvString, {
        encoding: FileSystem.EncodingType.UTF8
      });

      const fileInfo = await FileSystem.getInfoAsync(EXPORT_URI);
      console.log(`Wygenerowano plik o rozmiarze: ${fileInfo.size} bajtów`);

      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        showToast('Udostępnianie niedostępne na tym urządzeniu.', 'error');
        return;
      }

      await Sharing.shareAsync(EXPORT_URI, {
        mimeType: 'text/csv',
        dialogTitle: 'Zapisz badanie EKG z analizą szumów',
        UTI: 'public.comma-separated-values-text',
      });

      await FileSystem.deleteAsync(EXPORT_URI, { idempotent: true });
      console.log('Plik tymczasowy usunięty z pamięci urządzenia.');


    } catch (error) {
      console.error('Błąd zapisu:', error);
      showToast('Nie udało się wygenerować pliku z szumami.', 'error');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const ToastIcon = toastMessage?.type === 'error' ? AlertCircle : CheckCircle2;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {view === 'home' && (
            <HomeScreen
              bleState={bleState}
              deviceData={deviceData}
              syncState={syncState}
              diagnostics={diagnostics}
              toggleBluetooth={toggleBluetooth}
              refreshDiagnostics={refreshDiagnostics}
              getFileFromDevice={getFileFromDevice}
              isLiveEcgActive={isLiveEcgActive}
              toggleLiveEcg={handleToggleLiveEcg}
              lastConnectedTime={lastConnectedTime}
              openReport={openReport}
              formatDate={formatDate}
            />
          )}
          {view === 'history' && (
            <HistoryScreen records={records} openReport={openReport} formatDate={formatDate} />
          )}
          {view === 'report' && (
            <ReportScreen
              activeReportRecord={activeReportRecord} setView={setView} formatDate={formatDate}
              aiReport={aiReport} doctorEmail={doctorEmail} setDoctorEmail={setDoctorEmail}
              showToast={showToast}
            />
          )}
          {view === 'settings' && (
            <SettingsScreen
              isVoiceEnabled={isVoiceEnabled} handleVoiceToggle={handleVoiceToggle}
              isNotifEnabled={isNotifEnabled} setIsNotifEnabled={setIsNotifEnabled}
              isVibrateEnabled={isVibrateEnabled} setIsVibrateEnabled={setIsVibrateEnabled}
            />
          )}
        </ScrollView>

        <View style={styles.bottomNav}>
          <TouchableOpacity style={styles.navItem} onPress={() => setView('home')}>
            <Home size={22} color={view === 'home' ? '#818cf8' : '#71717a'} />
            <Text style={[styles.navText, view === 'home' && styles.navTextActive]}>PULPIT</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => setView('history')}>
            <History size={22} color={view === 'history' ? '#818cf8' : '#71717a'} />
            <Text style={[styles.navText, view === 'history' && styles.navTextActive]}>HISTORIA</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => setView('settings')}>
            <Settings size={22} color={view === 'settings' ? '#818cf8' : '#71717a'} />
            <Text style={[styles.navText, view === 'settings' && styles.navTextActive]}>OPCJE</Text>
          </TouchableOpacity>
        </View>

        <Animated.View style={[
          styles.toast,
          toastMessage?.type === 'error' ? styles.toastError : toastMessage?.type === 'info' ? styles.toastInfo : styles.toastSuccess,
          { transform: [{ translateY: toastAnim }] }
        ]}>
          {toastMessage && <ToastIcon size={20} color={toastMessage.type === 'error' ? "#fb7185" : "#34d399"} />}
          <Text style={styles.toastText}>{toastMessage?.message}</Text>
        </Animated.View>

      </SafeAreaView>
    </SafeAreaProvider>
  );
}
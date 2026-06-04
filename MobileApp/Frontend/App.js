import React, { useState, useRef, useEffect } from 'react';
import { ScrollView, Animated, View, Text, TouchableOpacity, StatusBar, Platform, PermissionsAndroid } from 'react-native';
import { SafeAreaView, SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
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

import AsyncStorage from '@react-native-async-storage/async-storage';

import * as Notifications from 'expo-notifications';

import * as Print from 'expo-print';

let Speech;
try {
  Speech = require('expo-speech');
} catch (e) {
  Speech = null;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const analyzeEcgTrend = (parsedTrend) => {
  let minBpm = 999, maxBpm = 0, sumBpm = 0, validBpmCount = 0;
  let minBpmTimeMs = 0, maxBpmTimeMs = 0;
  
  let tachyDetails = []; 
  let bradyDetails = []; 
  let importantDetails = [];
  
  let isCurrentlyTachy = false;
  let tachyStartTime = 0;
  let lastTachyEndTime = 0;
  
  let isCurrentlyBrady = false;
  let bradyStartTime = 0;
  let lastBradyEndTime = 0;

  let isCurrentlyImportant = false;
  let importantStartTime = 0;
  let importantMaxBpm = 0;
  
  const MIN_TIME_MS = 30000;       
  const MERGE_THRESHOLD_MS = 60000; 
  
  const TACHY_THRESHOLD = 100;
  const TACHY_STOP_THRESHOLD = 90;
  
  const BRADY_THRESHOLD = 50; // Zaczynamy epizod poniżej 50
  const BRADY_STOP_THRESHOLD = 55; // Kończymy powyżej 55

  const IGNORE_FIRST_MS = 60000; 

  for (let i = 0; i < parsedTrend.length; i++) {
    const point = parsedTrend[i];
    
    let isImportant = false;
    
    if (point.originalLine) {
      const parts = point.originalLine.split(',');
      if (parts.length >= 6 && parseInt(parts[5], 10) === 1) {
        isImportant = true;
      }
    } else if (point.Important !== undefined || point.important !== undefined) {
      isImportant = (point.Important == 1 || point.important == 1);
    }

    if (!isCurrentlyImportant) {
      if (isImportant) {
        isCurrentlyImportant = true;
        importantStartTime = point.timeMs;
        importantMaxBpm = point.bpm;
      }
    } else {
      if (point.bpm > importantMaxBpm) importantMaxBpm = point.bpm;
      if (!isImportant) {
        isCurrentlyImportant = false;
        importantDetails.push({ start: importantStartTime, end: point.timeMs, maxBpm: importantMaxBpm });
      }
    }
  }
  if (isCurrentlyImportant && parsedTrend.length > 0) {
    importantDetails.push({ start: importantStartTime, end: parsedTrend[parsedTrend.length - 1].timeMs, maxBpm: importantMaxBpm });
  }

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

    //TACHYKARDIA
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

    //BRADYKARDIA
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
      // Podczas bradykardii szukamy najniższej wartości
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
    importantDetails: importantDetails,
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

const speakReportSummary = (stats, durationMins, durationSecs, isVoiceEnabled) => {
  if (!isVoiceEnabled || !Speech) return;
  
  Speech.stop();

  const minText = durationMins === 1 ? "minutę" : [2, 3, 4].includes(durationMins % 10) && ![12, 13, 14].includes(durationMins % 100) ? "minuty" : "minut";
  const secText = durationSecs === 1 ? "sekundę" : [2, 3, 4].includes(durationSecs % 10) && ![12, 13, 14].includes(durationSecs % 100) ? "sekundy" : "sekund";
  
  let textToSpeak = `Badanie zakończone. Zapisano ${durationMins} ${minText} i ${durationSecs} ${secText} pomiaru. `;
  textToSpeak += `Średnie tętno wyniosło ${stats.avgBpm} Bi Pi Em . `;
  textToSpeak += `Najniższe zanotowane tętno to ${stats.minBpm}, a najwyższe ${stats.maxBpm} Bi Pi Em . `;
  
  const arrhythmias = stats.arrhythmiaEvents || 0;
  const manualEvents = stats.importantDetails?.length || 0;

  if (arrhythmias > 0 || manualEvents > 0) {
    if (arrhythmias > 0) {
      const arrWord = arrhythmias === 1 ? "jeden epizod arytmii" : 
                      [2, 3, 4].includes(arrhythmias % 10) && ![12, 13, 14].includes(arrhythmias % 100) ? "epizody arytmii" : "epizodów arytmii";
      textToSpeak += `Algorytm wykrył ${arrhythmias === 1 ? "" : arrhythmias} ${arrWord}. `;
    }
    
    if (manualEvents > 0) {
      const manWord = manualEvents === 1 ? "jedno zdarzenie oznaczone" : 
                      [2, 3, 4].includes(manualEvents % 10) && ![12, 13, 14].includes(manualEvents % 100) ? "zdarzenia oznaczone" : "zdarzeń oznaczonych";
      textToSpeak += `Zanotowano ${manualEvents === 1 ? "" : manualEvents} ${manWord} przez pacjenta. `;
    }
    
    textToSpeak += `Sprawdź raport, aby poznać szczegóły.`;
  } else {
    textToSpeak += `Algorytm nie wykrył żadnych nieprawidłowości.`;
  }

  Speech.speak(textToSpeak, { language: 'pl-PL', rate: 0.95, pitch: 1.0 });
};

const FILE_URI = FileSystem.documentDirectory + 'current_examination.csv';
const HISTORY_FILE_URI = FileSystem.documentDirectory + 'history_records.json';

function MainApp() {
  const insets = useSafeAreaInsets();
  
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

  const [records, setRecords] = useState([]);
  const [deviceData, setDeviceData] = useState(null);

  const [diagnostics, setDiagnostics] = useState(null);

  const [activeReportRecord, setActiveReportRecord] = useState(null);
  const [aiReport, setAiReport] = useState(null);
  const [doctorEmail, setDoctorEmail] = useState('');

  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [isNotifEnabled, setIsNotifEnabled] = useState(true);

  const [toastMessage, setToastMessage] = useState(null);
  const toastAnim = useRef(new Animated.Value(200)).current;
  const toastTimeoutRef = useRef(null);
  
  const [progressPercent, setProgressPercent] = useState(0);
  const progressIntervalRef = useRef(null);

  const [isLiveEcgActive, setIsLiveEcgActive] = useState(false);
  const [lastConnectedTime, setLastConnectedTime] = useState(null);

  const isReceivingFileRef = useRef(false);
  const readyResolveRef = useRef(null);
  const readyRejectRef = useRef(null);
  const transferResolveRef = useRef(null);
  const previousFileSize = useRef(null);
  const fileSize = useRef(null);
  const toBeReceived = useRef(null);
  const receivedFileSize = useRef(null);

  const fileBufferRef = useRef([]);
  const flushIntervalRef = useRef(null);
  const isFlushingRef = useRef(false);
  const fileWriteQueue = useRef(Promise.resolve());

  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Wczytywanie historii
  useEffect(() => {
    const loadPersistedData = async () => {
      try {
        const fileInfo = await FileSystem.getInfoAsync(HISTORY_FILE_URI);
        if (fileInfo.exists) {
          const savedRecords = await FileSystem.readAsStringAsync(HISTORY_FILE_URI);
          setRecords(JSON.parse(savedRecords));
        }

        const savedSessionId = await AsyncStorage.getItem('@rythmio_session_id');
        if (savedSessionId) setCurrentSessionId(savedSessionId);

        // Wczytywanie ustawień
        const savedVoice = await AsyncStorage.getItem('@rythmio_voice');
        const savedNotif = await AsyncStorage.getItem('@rythmio_notif');
        
        if (savedVoice !== null) setIsVoiceEnabled(savedVoice === 'true');
        if (savedNotif !== null) setIsNotifEnabled(savedNotif === 'true');

      } catch (e) {
        console.error('Błąd podczas wczytywania danych:', e);
      } finally {
      setIsLoaded(true); 
      }
    };
    loadPersistedData();
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    const saveData = async () => {
      try {
        await FileSystem.writeAsStringAsync(HISTORY_FILE_URI, JSON.stringify(records), { encoding: FileSystem.EncodingType.UTF8 });
        
        if (currentSessionId) await AsyncStorage.setItem('@rythmio_session_id', currentSessionId);
        else await AsyncStorage.removeItem('@rythmio_session_id'); 

        // Zapis ustawień
        await AsyncStorage.setItem('@rythmio_voice', isVoiceEnabled.toString());
        await AsyncStorage.setItem('@rythmio_notif', isNotifEnabled.toString());

      } catch (e) {
        console.error('Błąd podczas zapisywania:', e);
      }
    };
    saveData();
  }, [records, currentSessionId, isVoiceEnabled, isNotifEnabled]);

  // Zapytanie o uprawnienia do powiadomień
  useEffect(() => {
    const requestNotificationPermissions = async () => {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      // Jeśli nie ma uprawnień, poproś o nie
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('Brak uprawnień do powiadomień Push!');
      }
    };

    requestNotificationPermissions();
  }, []);

  // Zapisanie otrzymanej wielkości pliku
  useEffect(() => {
    AsyncStorage.getItem('fileSize').then(val => {
      if (val) fileSize.current = parseInt(val, 10);
    });
  }, []);

  const showToast = (message, type = 'success', suppressVoice = false) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    setToastMessage({ message, type });
    Animated.spring(toastAnim, { toValue: 0, useNativeDriver: true, friction: 8 }).start();

    if (isVoiceEnabled && Speech && type !== 'loading' && !suppressVoice) {
      Speech.stop();
      Speech.speak(message, { language: 'pl-PL', rate: 1.05 });
    }

    if (type === 'loading') {
      setProgressPercent(0);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      
      progressIntervalRef.current = setInterval(() => {
        setProgressPercent(prev => {
            return Math.floor(Math.min(99, (receivedFileSize.current / (toBeReceived.current || 1)) * 100));
        });
      }, 130); 
    } else {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      if (type !== 'success') {
        setProgressPercent(0);
      }
      
      toastTimeoutRef.current = setTimeout(() => {
        Animated.timing(toastAnim, { toValue: 200, duration: 300, useNativeDriver: true }).start(({ finished }) => {
          if (finished) {
            setToastMessage(null);
            setProgressPercent(0);
            receivedFileSize.current = 0;
          }
        });
      }, 3500);
    }
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
      const rythmio = paired.find(device => device.name === "RYTHMIO");
      if (!rythmio) {
        showToast("Nie znaleziono urządzenia. Sparuj je w ustawieniach telefonu.", "error");
        return;
      }

      const device = await connectToDevice(rythmio.address);
      if (!device) {
        showToast("Nie udało połączyć się z urządzeniem.", "error");
        return;
      }

      deviceRef.current = device;
      setBleState('connected');
      showToast('Nawiązano bezpieczne połączenie z holterem.');

      setIsLiveEcgActive(false);
      setLastConnectedTime(new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }));

      sendData(rythmio.address, "GET_STATE");
      subscriptionRef.current = receiveData(rythmio.address, (rawData) => {
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

      if (trimmed.startsWith('READY')) {
        const totalSize = parseInt(trimmed.split(' ')[1], 10);
        previousFileSize.current = fileSize.current || 0;
        toBeReceived.current = Math.max(0, totalSize - previousFileSize.current);
        
        fileSize.current = totalSize;
        AsyncStorage.setItem('fileSize', String(totalSize)).catch(e =>
          console.warn('Failed to persist fileSize:', e)
        );
        readyResolveRef.current?.();
        readyResolveRef.current = null;
        return;
      }

      if (trimmed.startsWith('SIZE')) {
        showToast('Plik na urządzeniu jest mniejszy niż lokalny. Usuń lokalny plik przed nowym transferem.', 'error');
        isReceivingFileRef.current = false;
        readyRejectRef.current?.('SIZE_MISMATCH');
        readyRejectRef.current = null;
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
      console.warn('Failed to parse data from RYTHMIO:', rawData);
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

  const formatSDCard = () => {
    if (bleState !== 'connected' || !deviceRef.current) {
      showToast('Najpierw połącz urządzenie Bluetooth.', 'error');
      return;
    }
    
    showToast('Usuwanie badania z karty SD w urządzeniu...', 'info');
    sendData(deviceRef.current.address, "REMOVE_FILE");
  };

  const getFileFromDevice = async () => {
    receivedFileSize.current = 0;
    transferResolveRef.current=null;
    if (bleState !== 'connected') {
      showToast('Najpierw połącz urządzenie.', 'error');
      return;
    }

    setSyncState('syncing');

    const lastSavedTS = await getLastTimestampFromFile();
    console.log("Last timestamp found in file:", lastSavedTS);

    showToast('Pobieranie badania z holtera...', 'loading');

    try {

      const waitForReady = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timeout: Device not ready")), 5000);
        readyResolveRef.current = () => {
          clearTimeout(timeout);
          resolve();
        };
        readyRejectRef.current = (reason) => {
          clearTimeout(timeout);
          reject(new Error(reason));
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

      sendData(deviceRef.current.address, `OK ${lastSavedTS} ${previousFileSize.current}`);
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

      showToast('Trwa analiza EKG...', 'loading');

      const fileContent = await FileSystem.readAsStringAsync(FILE_URI, {
        encoding: FileSystem.EncodingType.UTF8
      });

      const parsedTrend = parseEcgFileToTrend(fileContent);

      if (!parsedTrend || parsedTrend.length === 0) {
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        setProgressPercent(0);
        showToast('Błąd: Plik jest pusty lub uszkodzony.', 'error');
        setSyncState('idle');
        return;
      }

      const stats = analyzeEcgTrend(parsedTrend);
      const lastTimeMs = parsedTrend[parsedTrend.length - 1].timeMs;
      const durationMins = Math.floor(lastTimeMs / 60000);
      const durationSecs = Math.floor((lastTimeMs % 60000) / 1000);

      let sessionId = currentSessionId;
      if (!sessionId) {
        sessionId = Date.now().toString();
        setCurrentSessionId(sessionId);
      }

      const newData = {
        id: sessionId,
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
        importantDetails: stats.importantDetails,
        arrhythmiaEvents: stats.arrhythmiaEvents, 
        veb: { total: 0, pairs: 0, runs: 0, burden: "0%" },
        sveb: { total: 0, pairs: 0, runs: 0, burden: "0%" },
        pauses: { count: 0, longest: "0", longestTime: "--" },
        hourlyTrend: parsedTrend
      };

      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setProgressPercent(100);

      setTimeout(() => {
        setDeviceData(newData);
        
        setRecords(prev => {
          const existingIdx = prev.findIndex(r => r.id === sessionId);
          if (existingIdx >= 0) {
            const updated = [...prev];
            newData.date = updated[existingIdx].date; 
            updated[existingIdx] = newData;
            return updated;
          } else {
            return [newData, ...prev];
          }
        });

        setSyncState('synced');
        setAiReport(null);
        
        // Asystent głosowy
        if (isVoiceEnabled && Speech) {
          showToast('Analiza zakończona. Odtwarzam podsumowanie.', 'success', true);
          speakReportSummary(stats, durationMins, durationSecs, isVoiceEnabled);
        } else {
          showToast('Badanie odebrane i przeanalizowane!', 'success');
        }

        // Powiadomienia push
        if (isNotifEnabled) {
          Notifications.scheduleNotificationAsync({
            content: {
              title: "Raport gotowy 🫀",
              body: `Analiza EKG zakończona. Średnie tętno: ${stats.avgBpm} BPM. Zobacz szczegóły w raporcie.`
            },
            trigger: null, // trigger: null oznacza wysłanie NATYCHMIAST
          });
        }

      }, 400);

    } catch (error) {
      console.error("Błąd czytania pliku:", error);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setProgressPercent(0);
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
          'Timestamp_ms,ECG_Raw,BPM,LeadOff,Activity,Important\n',
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
        receivedFileSize.current=receivedFileSize.current+dataToWrite.length;
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

  const importantList = record.importantDetails || [];
  importantList.forEach((ep, index) => { 
    const duration = (ep.end && ep.end > ep.start) ? (ep.end - ep.start) : 0;
    const centerTime = ep.start + duration / 2;

    snippets.push({
      title: `Ważne Zdarzenie #${index + 1}`,
      description: `Zgłoszona anomalia. Czas trwania: ${Math.round(duration / 1000)}s`,
      time: formatMsToTime(ep.start),
      hr: ep.maxBpm || '--', 
      data: getEcgSlice(record.hourlyTrend, centerTime, 600)
    });
  });

  const tachyFinding = tachyList.length > 0 
    ? `Wykryto ${tachyList.length} istotnych epizodów tachykardii (>100 BPM).` 
    : "Nie wykryto istotnych epizodów tachykardii.";

  const bradyFinding = bradyList.length > 0 
    ? `Wykryto ${bradyList.length} epizodów bradykardii (<50 BPM).` 
    : "Nie wykryto istotnych epizodów bradykardii.";

  const importantFinding = importantList.length > 0 
    ? `Wykryto ${importantList.length} ważnych zdarzeń oznaczonych przez pacjenta.` 
    : "Nie zarejestrowano ważnych zdarzeń oznaczonych przez pacjenta.";

  setAiReport({
      date: new Date(record.date).toLocaleDateString('pl-PL'),
      summary: `Przeanalizowano zapis EKG trwający ${record.duration}.`,
      findings: [
        `Tętno: Max ${record.maxBpm} BPM (${record.maxBpmTime}), Min ${record.minBpm} BPM (${record.minBpmTime}).`,
        tachyFinding,
        bradyFinding, 
        importantFinding,
        `Pauzy: Brak przerw > 2.0s.`
      ],
      recommendation: (tachyList.length > 3 || bradyList.length > 3 || importantList.length > 0) 
        ? "Wykryto znaczną liczbę epizodów arytmicznych lub błędów technicznych. Zobacz wycinki EKG, aby zweryfikować zdarzenia krytyczne. Ta analiza jedynie obrazuje wybrane wycinki z badania i nie jest diagnozą medyczną." 
        : "Algorytm nie wykrył istotnych, groźnych nieprawidłowości w badanym okresie. UWAGA: Raport ma wyłącznie charakter informacyjny i nie zastępuje profesjonalnej diagnozy lekarskiej. Zawsze konsultuj swoje wyniki ze specjalistą.",
      snippets: snippets, 
      tachyDetails: tachyList,
      bradyDetails: bradyList 
    });

  setView('report');
};

  const loadMockReport = () => {
    const record = createMockReportRecord();
    setDeviceData(record);
    setRecords(prev => [record, ...prev]);
    setAiReport(null);
    openReport(record);
    showToast('Wczytano próbne dane i otwarto raport testowy.', 'success');
  };

  const handleGeneratePdfReport = async (eventComments = {}) => {
    if (!activeReportRecord) {
      showToast('Brak raportu do wygenerowania PDF.', 'error');
      return;
    }

    const reportData = {
      ...activeReportRecord,
      summary: aiReport?.summary || `Raport EKG z dnia ${formatDate(activeReportRecord.date)}`,
      findings: aiReport?.findings || [],
      recommendation: aiReport?.recommendation || '',
      snippets: aiReport?.snippets || [],
      tachyDetails: activeReportRecord.tachyDetails || [],
      bradyDetails: activeReportRecord.bradyDetails || [],
      importantDetails: activeReportRecord.importantDetails || [],
      eventComments: eventComments
    };

    await generatePdfReport(reportData);
  };

const createMockReportRecord = () => {
  const now = new Date();

  const generateEcgSample = (tick) => {
    let value = Math.random() * 600 - 300;
    const cycle = tick % 250;

    if (cycle > 20 && cycle < 40) value += 1000 * Math.sin((cycle - 20) * Math.PI / 20);
    else if (cycle === 50) value -= 2000;
    else if (cycle === 53) value += 7800;
    else if (cycle === 56) value -= 6500;
    else if (cycle > 90 && cycle < 130) value += 2000 * Math.sin((cycle - 90) * Math.PI / 40);

    if (tick % 1000 > 750) {
      if (cycle === 50) value -= 3000;
      else if (cycle === 55) value += 12000;
      else if (cycle === 65) value -= 9000;
      else if (cycle > 90 && cycle < 140) value -= 3000 * Math.sin((cycle - 90) * Math.PI / 50);
    }

    return Math.round(value);
  };

  const hourlyTrend = Array.from({ length: 120 }).map((_, index) => {
    const timeMs = index * 120000;
    const baseBpm = 70 + Math.round(12 * Math.sin(index / 12));
    const bpm = Math.max(40, Math.min(150, baseBpm + Math.round(Math.random() * 16 - 8)));
    const activity = Math.round(Math.random() * 10);
    const ecgRaw = generateEcgSample(index * 7);
    return {
      time: `${Math.floor(timeMs / 60000)}:${String(Math.floor((timeMs % 60000) / 1000)).padStart(2, '0')}`,
      bpm,
      timeMs,
      activity,
      EKG_Raw: ecgRaw,
      originalLine: `${timeMs},${ecgRaw},${bpm},0,${activity},0`
    };
  });

  const stats = analyzeEcgTrend(hourlyTrend);
  const mockRecord = {
    id: `mock-${Date.now()}`,
    date: now.toISOString(),
    duration: "24:00:00",
    totalBeats: hourlyTrend.length,
    avgBpm: stats.avgBpm,
    minBpm: stats.minBpm,
    minBpmTime: formatMsToTime(stats.minBpmTimeMs),
    minBpmTimeMs: stats.minBpmTimeMs,
    maxBpm: stats.maxBpm,
    maxBpmTime: formatMsToTime(stats.maxBpmTimeMs),
    maxBpmTimeMs: stats.maxBpmTimeMs,
    tachyEpisodes: stats.tachyEpisodes,
    tachyDetails: stats.tachyDetails.length ? stats.tachyDetails : [{ start: 1800000, end: 1860000, maxBpm: 128 }],
    bradyEpisodes: stats.bradyEpisodes,
    bradyDetails: stats.bradyDetails.length ? stats.bradyDetails : [{ start: 7200000, end: 7260000, minBpm: 48 }],
    importantDetails: stats.importantDetails.length ? stats.importantDetails : [{ start: 10800000, end: 10860000, maxBpm: 72 }],
    arrhythmiaEvents: stats.arrhythmiaEvents,
    veb: { total: 3, pairs: 0, runs: 0, burden: "< 0.1%" },
    sveb: { total: 8, pairs: 0, runs: 0, burden: "< 0.1%" },
    pauses: { count: 1, longest: "2.2s", longestTime: "03:15:10" },
    hourlyTrend: hourlyTrend,
  };
  return mockRecord;
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

function generateBpmTrendSvg(trend) {
  if (!trend || trend.length < 2) return '';
  const W = 700, H = 200, PL = 40, PR = 10, PT = 15, PB = 28;
  const dW = W - PL - PR, dH = H - PT - PB;
  const bpmV = trend.map(d => d.bpm);
  const mn = Math.max(0, Math.floor((Math.min(...bpmV) - 5) / 10) * 10);
  const mx = Math.ceil((Math.max(...bpmV) + 5) / 10) * 10;
  const rng = mx - mn || 1;
  const gX = i => PL + (i / (trend.length - 1)) * dW;
  const gY = b => PT + dH - ((b - mn) / rng) * dH;
  const pD = trend.map((d, i) => `${i === 0 ? 'M' : 'L'}${gX(i).toFixed(1)},${gY(d.bpm).toFixed(1)}`).join('');
  const aD = `${pD}L${gX(trend.length - 1).toFixed(1)},${(PT + dH).toFixed(1)}L${PL.toFixed(1)},${(PT + dH).toFixed(1)}Z`;
  const nY = 3;
  const yL = Array.from({ length: nY }, (_, i) => ({ y: gY(mn + (rng / (nY - 1)) * i), l: Math.round(mn + (rng / (nY - 1)) * i) }));
  const nX = Math.min(7, Math.max(3, Math.floor(trend.length / 15)));
  const xL = Array.from({ length: nX }, (_, i) => { const idx = Math.floor(i * (trend.length - 1) / (nX - 1)); const s = Math.floor(trend[idx].timeMs / 1000); return { x: gX(idx), l: `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}` }; });
  return `<svg width="100%" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6366f1" stop-opacity="0.15"/><stop offset="100%" stop-color="#6366f1" stop-opacity="0"/></linearGradient></defs>${yL.map(l => `<line x1="${PL}" y1="${l.y.toFixed(1)}" x2="${W - PR}" y2="${l.y.toFixed(1)}" stroke="#e0e0e0" stroke-width="1" stroke-dasharray="4,4"/><text x="${PL - 6}" y="${(l.y + 4).toFixed(1)}" fill="#666" font-size="10" text-anchor="end">${l.l}</text>`).join('')}${xL.map(l => `<text x="${l.x.toFixed(1)}" y="${H - 8}" fill="#666" font-size="9" text-anchor="middle">${l.l}</text>`).join('')}<path d="${aD}" fill="url(#bg)"/><path d="${pD}" fill="none" stroke="#6366f1" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

function generateActivityTrendSvg(trend) {
  if (!trend || trend.length < 2) return '';
  const W = 700, H = 150, PL = 40, PR = 10, PT = 10, PB = 25;
  const dW = W - PL - PR, dH = H - PT - PB;
  const maxA = 10;
  const gX = i => PL + (i / (trend.length - 1)) * dW;
  const gY = a => PT + dH - (Math.min(a || 0, maxA) / maxA) * dH;
  const pD = trend.map((d, i) => `${i === 0 ? 'M' : 'L'}${gX(i).toFixed(1)},${gY(d.activity || 0).toFixed(1)}`).join('');
  const aD = `${pD}L${gX(trend.length - 1).toFixed(1)},${(PT + dH).toFixed(1)}L${PL.toFixed(1)},${(PT + dH).toFixed(1)}Z`;
  const nX = Math.min(7, Math.max(3, Math.floor(trend.length / 15)));
  const xL = Array.from({ length: nX }, (_, i) => { const idx = Math.floor(i * (trend.length - 1) / (nX - 1)); const s = Math.floor(trend[idx].timeMs / 1000); return { x: gX(idx), l: `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}` }; });
  return `<svg width="100%" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#34d399" stop-opacity="0.2"/><stop offset="100%" stop-color="#34d399" stop-opacity="0"/></linearGradient></defs><line x1="${PL}" y1="${PT}" x2="${PL}" y2="${PT + dH}" stroke="#e0e0e0" stroke-width="1"/><line x1="${PL}" y1="${(PT + dH / 2).toFixed(1)}" x2="${W - PR}" y2="${(PT + dH / 2).toFixed(1)}" stroke="#e0e0e0" stroke-width="1" stroke-dasharray="4,4"/><line x1="${PL}" y1="${PT + dH}" x2="${W - PR}" y2="${PT + dH}" stroke="#e0e0e0" stroke-width="1"/><text x="${PL - 6}" y="${PT + 4}" fill="#666" font-size="10" text-anchor="end">100%</text><text x="${PL - 6}" y="${(PT + dH / 2 + 4).toFixed(1)}" fill="#666" font-size="10" text-anchor="end">50%</text><text x="${PL - 6}" y="${PT + dH + 4}" fill="#666" font-size="10" text-anchor="end">0%</text>${xL.map(l => `<text x="${l.x.toFixed(1)}" y="${H - 8}" fill="#666" font-size="9" text-anchor="middle">${l.l}</text>`).join('')}<path d="${aD}" fill="url(#ag)"/><path d="${pD}" fill="none" stroke="#34d399" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

function generateEcgStripSvg(data) {
  if (!data || data.length < 2) return '';
  const W = 600, H = 100, PL = 5, PR = 5, PT = 5, PB = 5;
  const dW = W - PL - PR, dH = H - PT - PB;
  const mn = Math.min(...data), mx = Math.max(...data), rng = (mx - mn) || 1;
  const gX = i => PL + (i / (data.length - 1)) * dW;
  const gY = v => PT + dH - ((v - mn) / rng) * dH;
  const pD = data.map((v, i) => `${i === 0 ? 'M' : 'L'}${gX(i).toFixed(1)},${gY(v).toFixed(1)}`).join('');
  return `<svg width="100%" viewBox="0 0 ${W} ${H}"><rect x="0" y="0" width="${W}" height="${H}" fill="#f8f8f8" rx="4"/><path d="${pD}" fill="none" stroke="#10b981" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

const generatePdfReport = async (reportData) => {
  await new Promise(resolve => setTimeout(resolve, 500));
  try {
    if (!reportData) {
      showToast('Brak danych do wygenerowania raportu PDF.', 'error');
      return;
    }

    const tachyRows = (reportData.tachyDetails || []).slice(0, 10).map((d, i) => `
      <tr>
        <td>Epizod #${i + 1}</td>
        <td>${formatMsToTime(d.start)}</td>
        <td>${formatMsToTime(d.end)}</td>
        <td>${Math.round((d.end - d.start) / 1000)}s</td>
        <td>${d.maxBpm} BPM</td>
      </tr>`).join('');

    const bradyRows = (reportData.bradyDetails || []).slice(0, 10).map((d, i) => `
      <tr>
        <td>Epizod #${i + 1}</td>
        <td>${formatMsToTime(d.start)}</td>
        <td>${formatMsToTime(d.end)}</td>
        <td>${Math.round((d.end - d.start) / 1000)}s</td>
        <td>${d.minBpm} BPM</td>
      </tr>`).join('');

    const importantRows = (reportData.importantDetails || []).map((d, i) => `
      <tr>
        <td>Zdarzenie #${i + 1}</td>
        <td>${formatMsToTime(d.start)}</td>
        <td>${formatMsToTime(d.end)}</td>
        <td>${Math.round((d.end - d.start) / 1000)}s</td>
        <td>${d.maxBpm || '--'} BPM</td>
      </tr>`).join('');

    const findingsHtml = (reportData.findings || [])
      .map(f => `<li>${f}</li>`).join('');

    const bpmChartSvg = generateBpmTrendSvg(reportData.hourlyTrend);
    const activityChartSvg = generateActivityTrendSvg(reportData.hourlyTrend);

    const eventComments = reportData.eventComments || {};
    const snippetsHtml = (reportData.snippets || []).map((s, i) => {
      const ecgSvg = generateEcgStripSvg(s.data);
      if (!ecgSvg) return '';
      const comment = eventComments[i];
      return `
        <div style="margin: 12px 0; padding: 8px; border: 1px solid #e0e0e0; border-radius: 6px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="font-weight: bold; font-size: 12px; color: #333;">${s.title}</span>
            <span style="font-size: 11px; color: #666;">${s.time || ''} &mdash; HR: ${s.hr || '--'} bpm</span>
          </div>
          ${ecgSvg}
          ${comment ? `
          <div style="margin-top: 6px; padding: 6px 10px; background: #f5f5ff; border-left: 3px solid #818cf8; border-radius: 4px;">
            <span style="font-size: 10px; color: #666; font-weight: bold; text-transform: uppercase;">Komentarz pacjenta:</span>
            <p style="margin: 2px 0 0; font-size: 11px; color: #444;">${comment}</p>
          </div>` : ''}
        </div>`;
    }).join('');

    const html = `
      <html>
      <head>
        <meta charset="utf-8"/>
        <style>
          @page { margin: 40px 24px; }
          body { font-family: Helvetica, Arial, sans-serif; color: #222; padding: 0 24px; font-size: 13px; }
          h1 { text-align: center; font-size: 22px; margin-bottom: 4px; }
          h2 { font-size: 15px; margin-top: 20px; margin-bottom: 6px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
          .subtitle { text-align: center; color: #777; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 12px; }
          th { background: #f0f0f0; text-align: left; padding: 5px 8px; }
          td { padding: 4px 8px; border-bottom: 1px solid #eee; }
          .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; margin-top: 6px; }
          .stat { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid #f0f0f0; }
          .stat-label { color: #666; }
          .stat-value { font-weight: bold; }
          .chart-caption { font-size: 11px; color: #888; text-align: center; margin-top: 2px; margin-bottom: 10px; }
          .recommendation { background: #f9f9f9; border-left: 3px solid #818cf8; padding: 10px 14px; margin-top: 6px; font-size: 12px; color: #444; }
          .footer { text-align: center; color: #aaa; font-size: 10px; margin-top: 30px; }
          .page-start { page-break-before: always; }
          .keep-together { page-break-inside: avoid; }
        </style>
      </head>
      <body>
        <h1>RAPORT EKG</h1>
        <p class="subtitle">Data badania: ${reportData.date || '--'}</p>

        <h2>Podsumowanie</h2>
        <p>${reportData.summary || ''}</p>

        <h2>Statystyki</h2>
        <div class="stats-grid">
          <div class="stat"><span class="stat-label">Czas badania:</span><span class="stat-value">${reportData.duration || '--'}</span></div>
          <div class="stat"><span class="stat-label">Liczba QRS:</span><span class="stat-value">${(reportData.totalBeats || 0).toLocaleString()}</span></div>
          <div class="stat"><span class="stat-label">Średnie tętno:</span><span class="stat-value">${reportData.avgBpm || 0} BPM</span></div>
          <div class="stat"><span class="stat-label">Min tętno:</span><span class="stat-value">${reportData.minBpm || 0} BPM</span></div>
          <div class="stat"><span class="stat-label">Max tętno:</span><span class="stat-value">${reportData.maxBpm || 0} BPM</span></div>
          <div class="stat"><span class="stat-label">Epizody tachykardii:</span><span class="stat-value">${reportData.tachyEpisodes || 0}</span></div>
          <div class="stat"><span class="stat-label">Epizody bradykardii:</span><span class="stat-value">${reportData.bradyEpisodes || 0}</span></div>
          <div class="stat"><span class="stat-label">Ważne zdarzenia:</span><span class="stat-value">${reportData.importantDetails?.length || 0}</span></div>
        </div>

        ${bpmChartSvg ? `
        <h2>Trend tętna</h2>
        ${bpmChartSvg}
        <div class="chart-caption">Tętno (BPM) w czasie badania</div>` : ''}

        ${activityChartSvg ? `
        <h2>Trend aktywności</h2>
        ${activityChartSvg}
        <div class="chart-caption">Poziom aktywności pacjenta</div>` : ''}

        ${tachyRows ? `
        <h2>Epizody Tachykardii</h2>
        <table><thead><tr><th>#</th><th>Start</th><th>Koniec</th><th>Czas trwania</th><th>Max BPM</th></tr></thead>
        <tbody>${tachyRows}</tbody></table>` : ''}

        ${bradyRows ? `
        <h2>Epizody Bradykardii</h2>
        <table><thead><tr><th>#</th><th>Start</th><th>Koniec</th><th>Czas trwania</th><th>Min BPM</th></tr></thead>
        <tbody>${bradyRows}</tbody></table>` : ''}

        ${importantRows ? `
        <div class="page-start keep-together">
        <h2>Ważne Zdarzenia Pacjenta</h2>
        <table><thead><tr><th>#</th><th>Start</th><th>Koniec</th><th>Czas trwania</th><th>BPM</th></tr></thead>
        <tbody>${importantRows}</tbody></table>
        </div>` : ''}

        ${snippetsHtml ? `
        <h2>Wycinki EKG</h2>
        ${snippetsHtml}` : ''}

        ${findingsHtml ? `
        <div class="keep-together">
        <h2>Wnioski</h2>
        <ul>${findingsHtml}</ul>
        </div>` : ''}

        ${reportData.recommendation ? `
        <div class="keep-together">
        <h2>Zalecenia</h2>
        <div class="recommendation">${reportData.recommendation}</div>
        </div>` : ''}

        <p class="footer">Wygenerowano przez Rythmio &bull; Raport ma charakter informacyjny i nie zastępuje diagnozy lekarskiej.</p>
      </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({ html });

    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      showToast('Udostępnianie niedostępne na tym urządzeniu.', 'error');
      return;
    }

    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Zapisz raport EKG w formacie PDF',
      UTI: 'com.adobe.pdf',
    });

    await FileSystem.deleteAsync(uri, { idempotent: true });

  } catch (error) {
    console.error('Błąd generowania PDF:', error);
    showToast('Nie udało się wygenerować pliku PDF.', 'error');
  }
};

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const deleteRecordFromHistory = (id) => {
  setRecords(prev => prev.filter(record => record.id !== id));

  if (currentSessionId === id) {
     setCurrentSessionId(null);
  }
    
  showToast("Raport został usunięty z archiwum.", "info");
};

const deleteCurrentFile = async () => {
    try {
      const fileInfo = await FileSystem.getInfoAsync(FILE_URI);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(FILE_URI);
        fileSize.current = 0;
        prevoiusFileSize.current = 0;
        setDeviceData(null); 
        setCurrentSessionId(null); 
        showToast("Plik badania został usunięty.", "info");
      } else {
        showToast("Brak pliku do usunięcia.", "error");
      }
    } catch (error) {
      console.error("Błąd podczas usuwania pliku:", error);
      showToast("Nie udało się usunąć pliku.", "error");
    }
  };

  const ToastIcon = toastMessage?.type === 'error' ? AlertCircle : CheckCircle2;

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, StatusBar.currentHeight || 0) }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 + insets.bottom }]}
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
            deleteCurrentFile={deleteCurrentFile}
            loadMockReport={loadMockReport}
          />
        )}
        {view === 'history' && (
          <HistoryScreen 
            records={records} 
            openReport={openReport} 
            formatDate={formatDate} 
            deleteRecord={deleteRecordFromHistory} 
          />
        )}
        {view === 'report' && (
          <ReportScreen
            activeReportRecord={activeReportRecord} setView={setView} formatDate={formatDate}
            aiReport={aiReport} doctorEmail={doctorEmail} setDoctorEmail={setDoctorEmail}
            showToast={showToast} saveToDownloads={saveToDownloads} generatePdfReport={handleGeneratePdfReport}
            formatSDCard={formatSDCard} bleState={bleState}
          />
        )}
        {view === 'settings' && (
          <SettingsScreen
            isVoiceEnabled={isVoiceEnabled} handleVoiceToggle={handleVoiceToggle}
            isNotifEnabled={isNotifEnabled} setIsNotifEnabled={setIsNotifEnabled}
          />
        )}
      </ScrollView>

      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 16), paddingTop: 12, minHeight: 65 + insets.bottom, height: 'auto' }]}>
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
        toastMessage?.type === 'loading' && { backgroundColor: '#27272a', borderColor: '#52525b', paddingVertical: 18 },
        { transform: [{ translateY: toastAnim }], overflow: 'hidden', bottom: Math.max(insets.bottom, 16) + 75 } 
      ]}>
        
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            {toastMessage?.type !== 'loading' && (
               <ToastIcon size={20} color={toastMessage?.type === 'error' ? "#fb7185" : "#34d399"} />
            )}
            <Text style={[styles.toastText, toastMessage?.type === 'loading' && { marginLeft: 0 }, { flexShrink: 1 }]}>
              {toastMessage?.message}
            </Text>
          </View>

          {toastMessage?.type === 'loading' && (
            <Text style={{ color: '#818cf8', fontWeight: '800', fontSize: 13, marginLeft: 12 }}>
              {progressPercent}%
            </Text>
          )}
        </View>

        {toastMessage?.type === 'loading' && (
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <View style={{
              height: '100%',
              backgroundColor: '#818cf8',
              width: `${progressPercent}%` 
            }} />
          </View>
        )}
        
      </Animated.View>

    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <MainApp />
    </SafeAreaProvider>
  );
}
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
  const transferResolveRef = useRef(null);

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
  
  // useEffect(() => {
  //   flushIntervalRef.current = setInterval(() => {
  //     flushBuffer();
  //   }, 500); // every 500ms

  //   return () => {
  //     clearInterval(flushIntervalRef.current);
  //   };
  // }, []);

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
          if (prev >= 90) {
            clearInterval(progressIntervalRef.current);
            return 90;
          }
          return prev + 1;
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
      showToast('Nawiązano bezpieczne połączenie z RYTHMIO.');

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
    transferResolveRef.current=null;
    if (bleState !== 'connected') {
      showToast('Najpierw połącz urządzenie.', 'error');
      return;
    }

    setSyncState('syncing');

    const lastSavedTS = await getLastTimestampFromFile();
    console.log("Last timestamp found in file:", lastSavedTS);

    showToast('Pobieranie badania z Holtera...', 'loading');

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
              body: `Analiza EKG zakończona. Średnie tętno: ${stats.avgBpm} BPM. Zobacz szczegóły w raporcie.`,
              smallIcon: 'assets/rythmio_logo.png',
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
            showToast={showToast} saveToDownloads={saveToDownloads} 

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
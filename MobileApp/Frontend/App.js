import React, { useState, useRef, useEffect } from 'react';
import { ScrollView, Animated, View, Text, TouchableOpacity, StatusBar, Platform, PermissionsAndroid, Alert } from 'react-native';
import { generateReport } from './src/utils/AIService';
import { PUBLIC_PROVIDER_IDS } from './src/config/LlmProviders';
import { SafeAreaView, SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertCircle, CheckCircle2, Home, History, Settings } from 'lucide-react-native';
import { styles } from './src/constants/Theme';
import { generateMockEcgStrip } from './src/utils/Generators';
import { USE_MOCK_BT } from './src/config/Config';
import * as RealBT from './src/utils/BluetoothSerial';
import * as MockBT from './src/utils/MockBluetoothSerial';
const { requestBluetoothPermissions, getPairedDevices, connectToDevice, disconnectDevice, receiveData, sendData } =
  USE_MOCK_BT ? MockBT : RealBT;
const onDeviceDisconnected = USE_MOCK_BT ? null : RealBT.onDeviceDisconnected;

import HomeScreen from './src/screens/HomeScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import ReportScreen from './src/screens/ReportScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { ecgBuffer } from './src/utils/EcgBuffer.js'

import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';

import * as Sharing from 'expo-sharing';
import RNFS from 'react-native-fs';

import AsyncStorage from '@react-native-async-storage/async-storage';

import * as Notifications from 'expo-notifications';

import * as Print from 'expo-print';

import * as MailComposer from 'expo-mail-composer';

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
    const bpm = point.bpm;
    const timeMs = point.timeMs;

    const isImportant = point.important === true;
    if (!isCurrentlyImportant) {
      if (isImportant) { isCurrentlyImportant = true; importantStartTime = timeMs; importantMaxBpm = bpm; }
    } else {
      if (bpm > importantMaxBpm) importantMaxBpm = bpm;
      if (!isImportant) { isCurrentlyImportant = false; importantDetails.push({ start: importantStartTime, end: timeMs, maxBpm: importantMaxBpm }); }
    }
    if (bpm < 35 || bpm > 220 || point.isNoise) continue;
    if (timeMs < IGNORE_FIRST_MS) continue;

    if (bpm < minBpm){ minBpm = bpm; minBpmTimeMs = timeMs; }
    if (bpm > maxBpm){ maxBpm = bpm; maxBpmTimeMs = timeMs; }
    sumBpm += bpm;
    validBpmCount++;

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
      if (bpm < bradyDetails[currentIdx].minBpm) bradyDetails[currentIdx].minBpm = bpm;

      if (bpm > BRADY_STOP_THRESHOLD) {
        isCurrentlyBrady = false;
        lastBradyEndTime = timeMs;
        bradyDetails[bradyDetails.length - 1].end = timeMs;
        bradyStartTime = 0;
      }
    }
  }

  const lastTimeMs = parsedTrend.length > 0 ? parsedTrend[parsedTrend.length - 1].timeMs : 0;
  if (isCurrentlyTachy    && tachyDetails.length > 0)     tachyDetails[tachyDetails.length - 1].end = lastTimeMs;
  if (isCurrentlyBrady    && bradyDetails.length > 0)     bradyDetails[bradyDetails.length - 1].end = lastTimeMs;
  if (isCurrentlyImportant && parsedTrend.length > 0)    importantDetails.push({ start: importantStartTime, end: lastTimeMs, maxBpm: importantMaxBpm });

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

  let lo = 0, hi = trend.length - 1, closestIdx = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (trend[mid].timeMs === centerTimeMs) { closestIdx = mid; break; }
    if (trend[mid].timeMs < centerTimeMs) { lo = mid + 1; closestIdx = mid; }
    else hi = mid - 1;
  }

  const startIdx = Math.max(0, closestIdx - pointsToSide);
  const endIdx = Math.min(trend.length, closestIdx + pointsToSide);

  const slice = trend.slice(startIdx, endIdx).map(p => {
    let val = p.ecgRaw ?? p.EKG_Raw;
    if (val === undefined && p.originalLine) {
      val = parseInt(p.originalLine.split(',')[1], 10);
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
  const disconnectSubRef = useRef(null);
  const scrollViewRef = useRef(null);

  useEffect(() => {
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

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingStatus, setGeneratingStatus] = useState(null);

  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [isNotifEnabled, setIsNotifEnabled] = useState(true);

  const [toastMessage, setToastMessage] = useState(null);
  const toastOnPressRef = useRef(null);
  const toastAnim = useRef(new Animated.Value(200)).current;
  const toastTimeoutRef = useRef(null);

  const [isAiModalVisible, setIsAiModalVisible] = useState(false);
  
  const [progressPercent, setProgressPercent] = useState(0);
  const progressIntervalRef = useRef(null);

  const [isLiveEcgActive, setIsLiveEcgActive] = useState(false);
  const [lastConnectedTime, setLastConnectedTime] = useState(null);

  const isReceivingFileRef = useRef(false);
  const readyResolveRef = useRef(null);
  const readyRejectRef = useRef(null);
  const transferResolveRef = useRef(null);
  const transferRejectRef = useRef(null);
  const previousFileSize = useRef(null);
  const fileSize = useRef(null);
  const toBeReceived = useRef(null);
  const receivedFileSize = useRef(null);

  const fileBufferRef = useRef([]);
  const isFlushingRef = useRef(false);
  const fileWriteQueue = useRef(Promise.resolve());

  const trendRawRef = useRef([]);
  const activitySumRef = useRef(0);
  const activityCntRef = useRef(0);

  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Wczytywanie historii
  useEffect(() => {
    const loadPersistedData = async () => {
      try {
        const fileInfo = await FileSystem.getInfoAsync(HISTORY_FILE_URI);
        let loadedRecords = [];
        if (fileInfo.exists) {
          const savedRecords = await FileSystem.readAsStringAsync(HISTORY_FILE_URI);
          loadedRecords = JSON.parse(savedRecords);
          setRecords(loadedRecords);
        }

        const savedSessionId = await AsyncStorage.getItem('@rythmio_session_id');
        if (savedSessionId) {
          setCurrentSessionId(savedSessionId);
          const matchingRecord = loadedRecords.find(r => r.id === savedSessionId);
          if (matchingRecord) {
            setDeviceData(matchingRecord);
          }
        }

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
        const recordsToSave = records.map(({ hourlyTrend, ...rest }) => rest);
        await FileSystem.writeAsStringAsync(HISTORY_FILE_URI, JSON.stringify(recordsToSave), { encoding: FileSystem.EncodingType.UTF8 });
        
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

  const showToast = (message, type = 'success', suppressVoice = false, onPress = null) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    toastOnPressRef.current = onPress;
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
    } else if (type === 'analyzing') {
      // Nie ruszaj progressPercent ani intervalu — transfer już 100%, trwa parsowanie
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

      // Listener na nieoczekiwane rozłączenie (zasięg, bateria, itp.)
      disconnectSubRef.current = onDeviceDisconnected?.(rythmio.address, () => {
        deviceRef.current = null;
        readyRejectRef.current?.('BLE_DISCONNECTED');
        readyRejectRef.current = null;
        readyResolveRef.current = null;
        transferRejectRef.current?.(new Error('BLE_DISCONNECTED'));
        transferRejectRef.current = null;
        transferResolveRef.current = null;
        isReceivingFileRef.current = false;
        fileBufferRef.current = [];
        setBleState('disconnected');
        setSyncState('idle');
        setIsLiveEcgActive(false);
        showToast('Utracono połączenie z holterem.', 'error');
      });

    } else {
      subscriptionRef.current?.remove();
      disconnectSubRef.current?.remove();
      disconnectSubRef.current = null;
      await disconnectDevice(deviceRef.current?.address);
      deviceRef.current = null;

      // Odblokuj wiszące Promise'y transferu jeśli rozłączono w trakcie pobierania
      readyRejectRef.current?.('BLE_DISCONNECTED');
      readyRejectRef.current = null;
      readyResolveRef.current = null;
      transferRejectRef.current?.(new Error('BLE_DISCONNECTED'));
      transferRejectRef.current = null;
      transferResolveRef.current = null;

      setBleState('disconnected');
      setSyncState('idle');
      showToast('Rozłączono urządzenie. Tryb odczytu lokalnego.', 'info');

      setIsLiveEcgActive(false);
    }
  };

  function handleIncomingData(rawData) {
    try {
      const trimmed = rawData.trim();
      if (!trimmed) return;

      if (trimmed.startsWith('READY')) {
        const totalSize = parseInt(trimmed.split(' ')[1], 10);
        previousFileSize.current = fileSize.current || 0;
        const delta = totalSize - previousFileSize.current;
        toBeReceived.current = delta > 0 ? delta : totalSize;
        
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
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        setProgressPercent(100);
        transferResolveRef.current?.();
        transferResolveRef.current = null;
        transferRejectRef.current = null;
        return;
      }

      if (isReceivingFileRef.current) {
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
    transferResolveRef.current = null;
    transferRejectRef.current = null;
    fileBufferRef.current = [];
    fileWriteQueue.current = Promise.resolve();
    isFlushingRef.current = false;
    isReceivingFileRef.current = false;
    trendRawRef.current = [];
    activitySumRef.current = 0;
    activityCntRef.current = 0;
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
        const timeout = setTimeout(() => reject(new Error("Timeout: Device not ready")), 15000);
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

      const localFileInfo = await FileSystem.getInfoAsync(FILE_URI);
      const actualLocalSize = localFileInfo.exists ? localFileInfo.size : 0;

      const bytesToReceive = toBeReceived.current || 0;
      const TRANSFER_TIMEOUT_MS = Math.max(5 * 60 * 1000, (bytesToReceive / 40000) * 1000 * 1.5);
      const transferComplete = new Promise((resolve, reject) => {
        transferResolveRef.current = resolve;
        transferRejectRef.current = reject;
        setTimeout(() => reject(new Error("Timeout: Transfer nie zakończył się w czasie")), TRANSFER_TIMEOUT_MS);
      });

      sendData(deviceRef.current.address, `OK ${lastSavedTS} ${actualLocalSize}`);
      await transferComplete;
      isReceivingFileRef.current = false;
      await flushBuffer();
      await fileWriteQueue.current;

      console.log('All data safely on disk.');

      const finalCheck = await FileSystem.getInfoAsync(FILE_URI);
      console.log(`Final file size: ${finalCheck.size} bytes`);

      showToast('Trwa analiza EKG...', 'analyzing');

      const raw = trendRawRef.current;
      const avgActivity = activityCntRef.current > 0
        ? activitySumRef.current / activityCntRef.current : 0;
      const motionNoiseThreshold = Math.max(avgActivity * 3, 6.0);
      let lastValidBpm = 0;
      let lastValidTimeMs = 0;

      for (let i = 0; i < raw.length; i++) {
        const pt = raw[i];
        let isNoise = false;
        if (pt.leadOff === 1)                                                                          isNoise = true;
        else if (pt.activity > motionNoiseThreshold)                                                   isNoise = true;
        else if (pt.bpm < 20 && pt.activity > 1.0)                                                    isNoise = true;
        else if (pt.ecgRaw === 0)                                                                      isNoise = true;
        else if (lastValidBpm > 0 && Math.abs(pt.bpm - lastValidBpm) > 50 && (pt.timeMs - lastValidTimeMs) < 15000) isNoise = true;
        else if (pt.bpm < 20 || pt.bpm > 250)                                                         isNoise = true;
        pt.isNoise = isNoise;
        if (!isNoise) { lastValidBpm = pt.bpm; lastValidTimeMs = pt.timeMs; }
      }

      const parsedTrend = raw;

      if (parsedTrend.length === 0) {
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

        // Powiadomienia push (expo-notifications niedostępne na web)
        if (isNotifEnabled && Platform.OS !== 'web') {
          Notifications.scheduleNotificationAsync({
            content: {
              title: "Raport gotowy 🫀",
              body: `Analiza EKG zakończona. Średnie tętno: ${stats.avgBpm} BPM. Zobacz szczegóły w raporcie.`
            },
            trigger: null,
          });
        }

      }, 400);

    } catch (error) {
      console.error("Błąd czytania pliku:", error);
      isReceivingFileRef.current = false;
      fileBufferRef.current = [];
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
      const line = data + '\n';
      fileBufferRef.current.push(line);
      receivedFileSize.current += line.length;

      if (fileBufferRef.current.length > 4000 && !isFlushingRef.current) {
        flushBuffer();
      }

      const parts = data.split(',');
      if (parts.length >= 5) {
        const timeMs = parseInt(parts[0], 10);
        const ecgRaw = parseInt(parts[1], 10);
        const bpm    = parseInt(parts[2], 10);
        const leadOff = parseInt(parts[3], 10);
        const actRaw  = parts[4].trim();
        const activity = actRaw === 'B' ? 0 : parseFloat(actRaw);
        const important = parts.length >= 6 ? parseInt(parts[5], 10) === 1 : false;

        if (!isNaN(timeMs) && !isNaN(bpm) && !isNaN(activity)) {
          trendRawRef.current.push({ timeMs, bpm, ecgRaw, leadOff, activity, important });
          activitySumRef.current += activity;
          activityCntRef.current += 1;
        }
      }
    } catch (error) {
      console.error('Failed to write to file:', error);
    }
  }

  const flushBuffer = async () => {
    if (fileBufferRef.current.length === 0) return fileWriteQueue.current;

    const dataToWrite = fileBufferRef.current.join('');
    fileBufferRef.current = [];
    isFlushingRef.current = true;

    fileWriteQueue.current = fileWriteQueue.current.then(async () => {
      try {
        await RNFS.appendFile(FILE_URI, dataToWrite, 'utf8');
      } catch (error) {
        console.error('Flush failed:', error);
      } finally {
        isFlushingRef.current = false;
      }
    });

    return fileWriteQueue.current;
  };

  const getLastTimestampFromFile = async () => {
    try {
      const fileInfo = await FileSystem.getInfoAsync(FILE_URI);
      if (!fileInfo.exists || !fileInfo.size) return "0";

      let tail;
      if (Platform.OS !== 'web' && RNFS?.read) {
        // Native: czytamy tylko ostatnie 256 bajtów
        tail = await RNFS.read(FILE_URI.replace('file://', ''), 256, Math.max(0, fileInfo.size - 256), 'utf8');
      } else {
        // Web: musimy wczytać cały plik
        const content = await FileSystem.readAsStringAsync(FILE_URI);
        const allLines = content.trim().split('\n').filter(Boolean);
        tail = allLines[allLines.length - 1] ?? '';
        const ts = tail.split(',')[0];
        return /^[0-9]+$/.test(ts) ? ts : "0";
      }

      const lines = tail.trim().split('\n').filter(Boolean);
      if (lines.length === 0) return "0";

      const lastLine = lines[lines.length - 1];
      const ts = lastLine.split(',')[0];
      return /^[0-9]+$/.test(ts) ? ts : "0";
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

  // Zapisuje wynik LLM do listy analiz rekordu (tablica, najnowsze pierwsze)
  const handleAiReportSaved = (entry) => {
    if (!activeReportRecord?.id) return;
    setRecords(prev => prev.map(r =>
      r.id === activeReportRecord.id
        ? { ...r, llmReports: [entry, ...(r.llmReports ?? migrateLegacyLlmReport(r))] }
        : r
    ));
  };

  // Usuwa pojedynczą analizę AI z rekordu po id
  const handleDeleteAiReport = (entryId) => {
    if (!activeReportRecord?.id) return;
    setRecords(prev => prev.map(r =>
      r.id === activeReportRecord.id
        ? { ...r, llmReports: (r.llmReports ?? []).filter(e => e._meta?.id !== entryId) }
        : r
    ));
  };

  // Generuje raport AI — stan przeżywa zmianę zakładki
  const doGenerateReport = async (llmConfig) => {
    setIsGenerating(true);
    setGeneratingStatus("Wysłano dane do analizy, proszę czekać…");
    try {
      const result = await generateReport(aiReport, activeReportRecord, llmConfig, () => {});
      handleAiReportSaved(result);
      setGeneratingStatus("Analiza gotowa");
      setTimeout(() => setGeneratingStatus(null), 3000);
      showToast("Analiza AI gotowa — kliknij, aby przejść", "success", false, () => {
        setView('report');
        setTimeout(() => setIsAiModalVisible(true), 350);
      });
    } catch (error) {
      console.error("Błąd generowania raportu:", error);
      setGeneratingStatus("Błąd: " + (error?.message ?? "generowanie nie powiodło się"));
      showToast("Błąd analizy AI: " + (error?.message ?? "nieznany błąd"), "error");
      setTimeout(() => setGeneratingStatus(null), 4000);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!aiReport) { showToast("Brak danych do analizy", "error"); return; }

    let llmConfig = null;
    try { const raw = await AsyncStorage.getItem('llm_config'); if (raw) llmConfig = JSON.parse(raw); } catch (_) {}

    if (!llmConfig) { showToast("Skonfiguruj dostawcę AI w Ustawieniach", "info"); setView('settings'); return; }

    if (PUBLIC_PROVIDER_IDS.includes(llmConfig.providerId)) {
      Alert.alert(
        '🔒 Prywatność danych',
        `Wybrano dostawcę: ${llmConfig.providerLabel ?? llmConfig.providerId}.\n\n` +
        'Dane badania zostaną przesłane do zewnętrznych serwerów tego dostawcy.\n\nNie wysyłaj danych jeśli nie akceptujesz warunków swojego dostawcy.',
        [
          { text: 'Anuluj', style: 'cancel' },
          { text: 'Rozumiem, kontynuuj', style: 'destructive', onPress: () => doGenerateReport(llmConfig) },
        ]
      );
      return;
    }
    doGenerateReport(llmConfig);
  };

  // Migracja starych rekordów z pojedynczym llmReport → llmReports[]
  function migrateLegacyLlmReport(record) {
    if (!record.llmReport) return [];
    return [{ ...record.llmReport, _meta: { id: 'legacy', timestamp: record.date, model: 'nieznany', providerLabel: 'Nieznany', promptTokens: 0, completionTokens: 0, totalTokens: 0 } }];
  }

  const loadMockReport = () => {
    const record = createMockReportRecord();
    setDeviceData(record);
    setRecords(prev => [record, ...prev]);
    setAiReport(null);
    openReport(record);
    showToast('Wczytano próbne dane i otwarto raport testowy.', 'success');
  };

  const handleGeneratePdfReport = async (eventComments = {}, mode = 'share', emailData = null) => {
    if (!activeReportRecord) {
      showToast('Brak raportu do wygenerowania PDF.', 'error');
      return;
    }

    const llmReports = activeReportRecord.llmReports
      ?? migrateLegacyLlmReport(activeReportRecord);
    const latestLlm = llmReports[0] ?? null;

    const reportData = {
      ...activeReportRecord,
      // Wstępna analiza algorytmiczna (snippety EKG, wnioski algorytmu)
      summary: aiReport?.summary || `Raport EKG z dnia ${formatDate(activeReportRecord.date)}`,
      findings: aiReport?.findings || [],
      recommendation: aiReport?.recommendation || '',
      snippets: aiReport?.snippets || [],
      tachyDetails: activeReportRecord.tachyDetails || [],
      bradyDetails: activeReportRecord.bradyDetails || [],
      importantDetails: activeReportRecord.importantDetails || [],
      eventComments: eventComments,
      // Analizy AI (LLM) — wszystkie zapisane, najnowsza pierwsza
      llmReports: llmReports,
      latestLlm: latestLlm,
    };

    await generatePdfReport(reportData, mode, emailData);
  };

const createMockReportRecord = () => {
  const now = new Date();

  // Czas trwania: 8h ± losowe minuty w zakresie ±1h (czyli 7h–9h)
  const randomMinuteOffset = Math.floor(Math.random() * 121) - 60; // -60..+60 min
  const durationMinutes   = 8 * 60 + randomMinuteOffset;           // 420–540 min
  const durationMs        = durationMinutes * 60 * 1000;
  const durationHours     = Math.floor(durationMinutes / 60);
  const durationRemMins   = durationMinutes % 60;
  const durationStr       = `${String(durationHours).padStart(2,'0')}:${String(durationRemMins).padStart(2,'0')}:00`;

  // ECG — wierny kształt PQRST z naturalnym szumem i artefaktami
  const generateEcgSample = (tick) => {
    const noise   = (Math.random() + Math.random() - 1) * 280; // gaussopodobny szum bazowy
    const wander  = 400 * Math.sin(tick / 420);                // powolne dryfowanie linii
    let value     = noise + wander;
    const cycle   = tick % 250;

    // Fala P
    if (cycle >= 20 && cycle < 40)  value += 900  * Math.sin((cycle - 20) * Math.PI / 20);
    // Kompleks QRS
    else if (cycle === 50)           value -= 1800;
    else if (cycle === 53)           value += 7800;
    else if (cycle === 56)           value -= 6200;
    // Fala T
    else if (cycle >= 90 && cycle < 130) value += 1800 * Math.sin((cycle - 90) * Math.PI / 40);

    // Co kilkaset uderzeń — mocniejszy QRS (zmienność biologiczna)
    if (tick % 900 > 680) {
      if      (cycle === 50)              value -= 2500;
      else if (cycle === 55)              value += 11000;
      else if (cycle === 65)              value -= 8500;
      else if (cycle >= 90 && cycle < 140) value -= 2500 * Math.sin((cycle - 90) * Math.PI / 50);
    }

    // Sporadyczny artefakt ruchowy (co ~3000 ticków, krótki)
    if (tick % 3100 > 3050) value += (Math.random() - 0.5) * 8000;

    return Math.round(value);
  };

  // BPM — Ornstein-Uhlenbeck random walk z fazami doby i epizodami
  const INTERVAL_MS = 120000; // punkt co 2 minuty
  const totalPoints = Math.ceil(durationMs / INTERVAL_MS);

  // Cel BPM zależny od fazy badania (0=start, 1=koniec)
  const getTargetBpm = (frac) => {
    if (frac < 0.12) return 58;  // spokój / leżenie przed snem
    if (frac < 0.22) return 54;  // najgłębszy sen
    if (frac < 0.40) return 62;  // sen lekki / fazy REM
    if (frac < 0.52) return 75;  // pobudka, wstawanie
    if (frac < 0.68) return 82;  // aktywność przedpołudniowa
    if (frac < 0.78) return 77;  // nieco spokojniej
    if (frac < 0.90) return 71;  // po południu
    return 65;                    // wieczór, wyciszenie
  };

  // Aktywność fizyczna zależna od fazy
  const getBaseActivity = (frac) => {
    if (frac < 0.40) return 0.8;   // noc — prawie zero
    if (frac < 0.52) return 4.0;   // poranny ruch
    if (frac < 0.68) return 6.5;   // aktywność
    if (frac < 0.78) return 3.5;   // spokojniej
    return 2.0;                     // wieczór
  };

  let bpmState = 65; // bieżący BPM — ciągły stan między punktami
  let nextTachyAt = Math.floor(totalPoints * (0.45 + Math.random() * 0.15));
  let nextBradyAt = Math.floor(totalPoints * (0.10 + Math.random() * 0.25));
  let tachyDuration = 0, bradyDuration = 0;

  const hourlyTrend = Array.from({ length: totalPoints }).map((_, index) => {
    const timeMs = index * INTERVAL_MS;
    const frac   = index / (totalPoints - 1);

    // Gauss-like noise (suma 3 uniform → bardziej centralna)
    const gaussNoise = (Math.random() + Math.random() + Math.random() - 1.5) * 2.8;

    // Mean reversion — powolne podążanie za celem (α=0.06 → zmiana ok. 6% różnicy co krok)
    bpmState += 0.06 * (getTargetBpm(frac) - bpmState) + gaussNoise;

    // Epizod tachykardii (jeden, trwa ~6–12 punktów = 12–24 min)
    if (index === nextTachyAt) tachyDuration = 6 + Math.floor(Math.random() * 7);
    if (tachyDuration > 0) { bpmState += 4 + Math.random() * 3; tachyDuration--; }

    // Epizod bradykardii (jeden, trwa ~4–8 punktów = 8–16 min)
    if (index === nextBradyAt) bradyDuration = 4 + Math.floor(Math.random() * 5);
    if (bradyDuration > 0) { bpmState -= 3 + Math.random() * 2; bradyDuration--; }

    const bpm      = Math.max(38, Math.min(160, Math.round(bpmState)));
    const actBase  = getBaseActivity(frac);
    const activity = Math.max(0, Math.round(actBase + (Math.random() - 0.5) * actBase * 0.7));
    const ecgRaw   = generateEcgSample(index * 7);

    return {
      time: `${Math.floor(timeMs / 60000)}:${String(Math.floor((timeMs % 60000) / 1000)).padStart(2, '0')}`,
      bpm,
      timeMs,
      activity,
      ecgRaw,
    };
  });

  const stats = analyzeEcgTrend(hourlyTrend);
  const mockRecord = {
    id: `mock-${Date.now()}`,
    date: now.toISOString(),
    duration: durationStr,
    totalBeats: hourlyTrend.length,
    avgBpm: stats.avgBpm,
    minBpm: stats.minBpm,
    minBpmTime: formatMsToTime(stats.minBpmTimeMs),
    minBpmTimeMs: stats.minBpmTimeMs,
    maxBpm: stats.maxBpm,
    maxBpmTime: formatMsToTime(stats.maxBpmTimeMs),
    maxBpmTimeMs: stats.maxBpmTimeMs,
    tachyEpisodes: stats.tachyEpisodes,
    tachyDetails: stats.tachyDetails.length ? stats.tachyDetails : [{ start: Math.floor(durationMs * 0.5), end: Math.floor(durationMs * 0.5) + 60000, maxBpm: 118 }],
    bradyEpisodes: stats.bradyEpisodes,
    bradyDetails: stats.bradyDetails.length ? stats.bradyDetails : [{ start: Math.floor(durationMs * 0.2), end: Math.floor(durationMs * 0.2) + 60000, minBpm: 46 }],
    importantDetails: stats.importantDetails.length ? stats.importantDetails : [{ start: Math.floor(durationMs * 0.65), end: Math.floor(durationMs * 0.65) + 60000, maxBpm: 79 }],
    arrhythmiaEvents: stats.arrhythmiaEvents,
    veb:  { total: 3, pairs: 0, runs: 0, burden: '< 0.1%' },
    sveb: { total: 8, pairs: 0, runs: 0, burden: '< 0.1%' },
    pauses: { count: 1, longest: '2.2s', longestTime: formatMsToTime(Math.floor(durationMs * 0.35)) },
    hourlyTrend,
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

function downsampleTrend(data, maxPoints = 200) {
  if (!data || data.length <= maxPoints) return data;
  const step = (data.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, i) => data[Math.round(i * step)]);
}

function generateBpmTrendSvg(trend) {
  trend = downsampleTrend(trend);
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
  trend = downsampleTrend(trend);
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

const generatePdfReport = async (reportData, mode = 'share', emailData = null) => {
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

    const llmReportsHtml = (reportData.llmReports || []).map((entry, idx) => {
      const meta = entry._meta || {};
      const ts = meta.timestamp
        ? (() => { try { return new Date(meta.timestamp).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return meta.timestamp; } })()
        : '--';
      const model = [meta.providerLabel, meta.model].filter(Boolean).join(' / ') || 'AI';
      const findingsList = Array.isArray(entry.findings) && entry.findings.length
        ? `<ul class="findings">${entry.findings.map(f => `<li>${f}</li>`).join('')}</ul>`
        : '';
      const rec = entry.recommendation
        ? `<div class="recommendation" style="margin-top:8px;">${entry.recommendation}</div>`
        : '';
      return `
        <div class="keep-together" style="margin-bottom:16px; padding:12px 14px; border:1px solid #c4b5fd; border-radius:6px; background:#faf8ff;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <span style="font-weight:bold; font-size:10.5pt; color:#4338ca;">Analiza AI #${idx + 1}</span>
            <span style="font-size:8.5pt; color:#888;">${model} &bull; ${ts}</span>
          </div>
          ${entry.summary ? `<p style="margin:0 0 8px; font-size:10.5pt; line-height:1.55;">${entry.summary}</p>` : ''}
          ${findingsList}
          ${rec}
        </div>`;
    }).join('');

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

    const formattedDate = reportData.date
      ? (() => { try { return new Date(reportData.date).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return reportData.date; } })()
      : '--';
    const generatedAt = (() => { try { return new Date().toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return new Date().toISOString(); } })();
    const hiddenTachy = Math.max(0, (reportData.tachyDetails || []).length - 10);
    const hiddenBrady = Math.max(0, (reportData.bradyDetails || []).length - 10);

    const html = `
      <html>
      <head>
        <meta charset="utf-8"/>
        <style>
          @page { margin: 18mm 15mm; }
          body { font-family: Helvetica, Arial, sans-serif; color: #1a1a1a; font-size: 11pt; line-height: 1.5; }

          /* Nagłówek */
          .header { border-bottom: 3px solid #6366f1; padding-bottom: 10px; margin-bottom: 14px; }
          .header-top { display: flex; justify-content: space-between; align-items: flex-start; }
          .brand { font-size: 22pt; font-weight: bold; color: #6366f1; letter-spacing: 1px; }
          .brand-sub { font-size: 9pt; color: #888; margin-top: 1px; }
          .report-meta { text-align: right; font-size: 9pt; color: #666; }
          .report-meta strong { color: #333; }

          h2 { font-size: 12pt; font-weight: bold; color: #4338ca; margin: 18px 0 6px;
               border-bottom: 1px solid #e0e0e0; padding-bottom: 3px; }

          /* Siatka statystyk */
          .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; margin: 6px 0 10px; }
          .stat { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f2f2f2; font-size: 10pt; }
          .stat-label { color: #555; }
          .stat-value { font-weight: bold; color: #111; }
          .stat-sub { font-size: 8.5pt; color: #888; }

          /* Tabele */
          table { width: 100%; border-collapse: collapse; margin: 6px 0 10px; font-size: 10pt; }
          thead th { background: #f0f0ff; color: #4338ca; text-align: left; padding: 5px 8px; font-size: 9.5pt; border-bottom: 2px solid #c7d2fe; }
          tbody td { padding: 4px 8px; border-bottom: 1px solid #eee; }
          tbody tr:nth-child(even) td { background: #fafafa; }
          .table-note { font-size: 9pt; color: #888; margin: -4px 0 8px; font-style: italic; }

          /* Wycinki EKG */
          .snippet { margin: 10px 0; padding: 8px 10px; border: 1px solid #e0e0e0; border-radius: 5px; page-break-inside: avoid; }
          .snippet-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
          .snippet-title { font-weight: bold; font-size: 10pt; color: #333; }
          .snippet-meta { font-size: 9.5pt; color: #666; }
          .snippet-comment { margin-top: 6px; padding: 5px 10px; background: #f5f5ff; border-left: 3px solid #818cf8; border-radius: 3px; font-size: 9pt; color: #444; }

          /* Wnioski i zalecenia */
          ul.findings { padding-left: 18px; margin: 4px 0; }
          ul.findings li { margin-bottom: 4px; font-size: 10.5pt; line-height: 1.55; }
          .recommendation { background: #f5f3ff; border: 1px solid #c4b5fd; border-radius: 5px; padding: 10px 14px; margin: 6px 0; font-size: 10.5pt; color: #3730a3; line-height: 1.55; }

          /* Podsumowanie */
          .summary-box { background: #f8faff; border-left: 4px solid #6366f1; padding: 10px 14px; border-radius: 0 5px 5px 0; margin: 6px 0 10px; font-size: 10.5pt; line-height: 1.6; }

          /* Legenda wykresu */
          .chart-caption { font-size: 9pt; color: #888; text-align: center; margin: 2px 0 12px; }

          /* Stopka */
          .footer { border-top: 1px solid #ddd; padding-top: 8px; margin-top: 24px; text-align: center; font-size: 8.5pt; color: #aaa; }

          .page-break { page-break-before: always; }
          .keep-together { page-break-inside: avoid; }
          .no-data { color: #aaa; font-style: italic; font-size: 10pt; }
        </style>
      </head>
      <body>

        <!-- Nagłówek -->
        <div class="header">
          <div class="header-top">
            <div>
              <div class="brand">RYTHMIO</div>
              <div class="brand-sub">Ambulatoryjny Holter EKG</div>
            </div>
            <div class="report-meta">
              <div><strong>Data badania:</strong> ${formattedDate}</div>
              <div><strong>Wygenerowano:</strong> ${generatedAt}</div>
              <div><strong>Czas trwania:</strong> ${reportData.duration || '--'}</div>
            </div>
          </div>
        </div>

        <!-- Podsumowanie AI -->
        ${reportData.summary ? `
        <h2>Podsumowanie kliniczne</h2>
        <div class="summary-box">${reportData.summary}</div>` : ''}

        <!-- Statystyki -->
        <h2>Parametry badania</h2>
        <div class="stats-grid">
          <div class="stat">
            <span class="stat-label">Liczba zespołów QRS:</span>
            <span class="stat-value">${(reportData.totalBeats || 0).toLocaleString('pl-PL')}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Średnie tętno:</span>
            <span class="stat-value">${reportData.avgBpm || 0} BPM</span>
          </div>
          <div class="stat">
            <span class="stat-label">Tętno minimalne:</span>
            <span class="stat-value">${reportData.minBpm || 0} BPM
              ${reportData.minBpmTime ? `<span class="stat-sub">(godz. ${reportData.minBpmTime})</span>` : ''}
            </span>
          </div>
          <div class="stat">
            <span class="stat-label">Tętno maksymalne:</span>
            <span class="stat-value">${reportData.maxBpm || 0} BPM
              ${reportData.maxBpmTime ? `<span class="stat-sub">(godz. ${reportData.maxBpmTime})</span>` : ''}
            </span>
          </div>
          <div class="stat">
            <span class="stat-label">Epizody tachykardii:</span>
            <span class="stat-value">${reportData.tachyEpisodes || 0}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Epizody bradykardii:</span>
            <span class="stat-value">${reportData.bradyEpisodes || 0}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Zdarzenia pacjenta:</span>
            <span class="stat-value">${reportData.importantDetails?.length || 0}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Rozpiętość tętna:</span>
            <span class="stat-value">${(reportData.maxBpm || 0) - (reportData.minBpm || 0)} BPM</span>
          </div>
        </div>

        <!-- Wykresy -->
        ${bpmChartSvg ? `
        <div class="keep-together">
          <h2>Trend tętna</h2>
          ${bpmChartSvg}
          <div class="chart-caption">Tętno (BPM) w czasie trwania badania</div>
        </div>` : ''}

        ${activityChartSvg ? `
        <div class="keep-together">
          <h2>Trend aktywności</h2>
          ${activityChartSvg}
          <div class="chart-caption">Poziom aktywności ruchowej pacjenta</div>
        </div>` : ''}

        <!-- Tachykardia -->
        ${tachyRows ? `
        <div class="keep-together">
          <h2>Epizody tachykardii (≥100 BPM przez ≥30 s)</h2>
          <table>
            <thead><tr><th>#</th><th>Początek</th><th>Koniec</th><th>Czas trwania</th><th>Maks. BPM</th></tr></thead>
            <tbody>${tachyRows}</tbody>
          </table>
          ${hiddenTachy > 0 ? `<p class="table-note">+ ${hiddenTachy} kolejnych epizodów niewyświetlonych</p>` : ''}
        </div>` : ''}

        <!-- Bradykardia -->
        ${bradyRows ? `
        <div class="keep-together">
          <h2>Epizody bradykardii (&lt;50 BPM przez ≥30 s)</h2>
          <table>
            <thead><tr><th>#</th><th>Początek</th><th>Koniec</th><th>Czas trwania</th><th>Min. BPM</th></tr></thead>
            <tbody>${bradyRows}</tbody>
          </table>
          ${hiddenBrady > 0 ? `<p class="table-note">+ ${hiddenBrady} kolejnych epizodów niewyświetlonych</p>` : ''}
        </div>` : ''}

        <!-- Zdarzenia pacjenta -->
        ${importantRows ? `
        <div class="keep-together">
          <h2>Zdarzenia oznaczone przez pacjenta</h2>
          <table>
            <thead><tr><th>#</th><th>Początek</th><th>Koniec</th><th>Czas trwania</th><th>BPM</th></tr></thead>
            <tbody>${importantRows}</tbody>
          </table>
        </div>` : ''}

        <!-- Wycinki EKG -->
        ${snippetsHtml ? `
        <h2>Reprezentatywne wycinki EKG</h2>
        ${snippetsHtml}` : ''}

        <!-- Wnioski AI -->
        ${findingsHtml ? `
        <div class="keep-together">
          <h2>Szczegółowe wnioski kliniczne</h2>
          <ul class="findings">${findingsHtml}</ul>
        </div>` : ''}

        <!-- Zalecenia algorytmu -->
        ${reportData.recommendation ? `
        <div class="keep-together">
          <h2>Zalecenia (analiza algorytmiczna)</h2>
          <div class="recommendation">${reportData.recommendation}</div>
        </div>` : ''}

        <!-- Analizy AI (LLM) -->
        ${llmReportsHtml ? `
        <div class="page-break">
          <h2>Analizy AI</h2>
          ${llmReportsHtml}
        </div>` : ''}

        <!-- Stopka -->
        <div class="footer">
          Wygenerowano przez Rythmio Holter EKG &bull;
          Raport ma charakter informacyjny i nie zastępuje diagnozy ani konsultacji lekarskiej.
        </div>

      </body>
      </html>
    `;

    // Na webie expo-print nie obsługuje printToFileAsync — otwieramy HTML w nowej karcie
    if (Platform.OS === 'web') {
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url  = URL.createObjectURL(blob);
      const win  = window.open(url, '_blank');
      if (win) {
        win.addEventListener('load', () => {
          win.focus();
          win.print();
        });
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      showToast('Raport otwarty — użyj "Zapisz jako PDF" w oknie drukowania.', 'info');
      return;
    }

    const { uri } = await Print.printToFileAsync({ html });
    const safeUri = FileSystem.cacheDirectory + `Raport_EKG_${Date.now()}.pdf`;
    await FileSystem.copyAsync({ from: uri, to: safeUri });

    if (mode === 'email') {
      try {
        const isAvailable = await MailComposer.isAvailableAsync();
        if (!isAvailable) {
          showToast('Brak klienta poczty. Otwieram menu udostępniania...', 'info');
          await Sharing.shareAsync(safeUri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Udostępnij raport EKG',
            UTI: 'com.adobe.pdf',
          });
        } else {
          await MailComposer.composeAsync({
            recipients: [emailData.doctorEmail],
            subject: `Wynik badania EKG - ${reportData.date ? formatDate(reportData.date) : ''}`,
            body: emailData.message,
            attachments: [safeUri],
          });
          
          await new Promise(resolve => setTimeout(resolve, 4000));
        }
      } catch (err) {
        console.warn("Błąd poczty: ", err);
        await Sharing.shareAsync(safeUri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Udostępnij raport EKG',
            UTI: 'com.adobe.pdf',
        });
      }
    } else {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        showToast('Udostępnianie niedostępne na tym urządzeniu.', 'error');
        return;
      }

      await Sharing.shareAsync(safeUri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Zapisz raport EKG w formacie PDF',
        UTI: 'com.adobe.pdf',
      });
    }

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
        previousFileSize.current = 0;
        await AsyncStorage.removeItem('fileSize');
        // Przerwij ewentualny trwający transfer
        isReceivingFileRef.current = false;
        fileBufferRef.current = [];
        fileWriteQueue.current = Promise.resolve();
        isFlushingRef.current = false;
        setSyncState('idle');
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

      {view === 'settings' && (
        <View style={{ flex: 1 }}>
          <SettingsScreen
            isVoiceEnabled={isVoiceEnabled} handleVoiceToggle={handleVoiceToggle}
            isNotifEnabled={isNotifEnabled} setIsNotifEnabled={setIsNotifEnabled}
            showToast={showToast}
          />
        </View>
      )}

      {view === 'report' && (
        <View style={{ flex: 1 }}>
          <ReportScreen
            activeReportRecord={activeReportRecord} setView={setView} formatDate={formatDate}
            aiReport={aiReport} setAiReport={setAiReport}
            llmReports={
              (records.find(r => r.id === activeReportRecord?.id)?.llmReports)
              ?? migrateLegacyLlmReport(activeReportRecord ?? {})
            }
            onDeleteAiReport={handleDeleteAiReport}
            onGenerateReport={handleGenerateReport}
            isGenerating={isGenerating}
            generatingStatus={generatingStatus}
            isAiModalVisible={isAiModalVisible}
            setIsAiModalVisible={setIsAiModalVisible}
            doctorEmail={doctorEmail} setDoctorEmail={setDoctorEmail}
            showToast={showToast} saveToDownloads={saveToDownloads} generatePdfReport={handleGeneratePdfReport}
            formatSDCard={formatSDCard} bleState={bleState}
          />
        </View>
      )}

      {(view === 'home' || view === 'history') && (
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
        </ScrollView>
      )}

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
        toastMessage?.type === 'loading' && { backgroundColor: '#27272a', borderColor: '#52525b', paddingTop: 14, paddingBottom: 8 },
        { transform: [{ translateY: toastAnim }], overflow: 'hidden', bottom: Math.max(insets.bottom, 16) + 75 }
      ]}>
        <TouchableOpacity
          activeOpacity={toastOnPressRef.current ? 0.7 : 1}
          onPress={() => { if (toastOnPressRef.current) { toastOnPressRef.current(); toastOnPressRef.current = null; } }}
          style={{ width: '100%' }}
        >
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
          <View style={{ marginTop: 10, height: 3, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <View style={{
              height: '100%',
              borderRadius: 2,
              backgroundColor: '#818cf8',
              width: `${progressPercent}%`
            }} />
          </View>
        )}
        </TouchableOpacity>
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
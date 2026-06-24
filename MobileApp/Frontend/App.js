import React, { useState, useRef, useEffect } from 'react';
import { ScrollView, Animated, View, Text, TouchableOpacity, StatusBar, Platform, Alert } from 'react-native';
import { generateReport } from './src/utils/AIService';
import { PUBLIC_PROVIDER_IDS } from './src/config/LlmProviders';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertCircle, CheckCircle2, Home, History, Settings } from 'lucide-react-native';
import { styles } from './src/constants/Theme';
import { createMockReportRecord } from './src/utils/Generators';
import { USE_MOCK_BT } from './src/config/Config';
import { analyzeEcgTrend, formatMsToTime, formatDate, getEcgSlice, speakReportSummary, migrateLegacyLlmReport } from './src/utils/EcgAnalysis';
import { parseEcgFileToTrend } from './src/utils/CsvParser';
import { generatePdfReport, saveToDownloads } from './src/utils/ReportExporter';
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

  const [currentBpm, setCurrentBpm] = useState('--');

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
        setProgressPercent(Math.floor(Math.min(99, (receivedFileSize.current / (toBeReceived.current || 1)) * 100)));
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
    if (Speech) Speech.stop();
    const msg = newState ? "Asystent głosowy został aktywowany." : "Asystent głosowy wyłączony.";
    if (newState && Speech) Speech.speak(msg, { language: 'pl-PL' });
    // suppressVoice=true bo stan React jeszcze się nie zaktualizował — speech obsłużony wyżej
    showToast(msg, "info", true);
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
        // Pełny transfer (lastTS=0): urządzenie wysyła cały plik → toBeReceived = totalSize
        // Inkrementalny: urządzenie wysyła tylko nowe bajty → toBeReceived = delta
        toBeReceived.current = delta;
        console.log(`[READY] totalSize=${totalSize} prevSize=${previousFileSize.current} delta=${delta} toBeReceived=${toBeReceived.current}`);
        const mb = (toBeReceived.current / 1024 / 1024).toFixed(1);
        showToast(`Pobieranie badania z holtera... (${mb} MB)`, 'loading');
        
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

      if (trimmed === 'S') {
        console.log(`[TRANSFER] 'S' received. received=${receivedFileSize.current} toBeReceived=${toBeReceived.current} ratio=${(receivedFileSize.current/(toBeReceived.current||1)*100).toFixed(1)}%`);
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
          console.log('[TRANSFER] interval cleared');
        }
        setProgressPercent(100);
        console.log('[TRANSFER] setProgressPercent(100) called');
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
      setCurrentBpm('--'); 
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
    toBeReceived.current = null;
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

      // ESP robi seek(actualLocalSize) i wysyła od tam do końca — dokładna liczba bajtów
      toBeReceived.current = (fileSize.current || 0) - actualLocalSize;
      if (toBeReceived.current <= 0) toBeReceived.current = fileSize.current || 1;
      console.log(`[TRANSFER] actualLocalSize=${actualLocalSize} fileSize=${fileSize.current} toBeReceived=${toBeReceived.current}`);

      const bytesToReceive = toBeReceived.current || 0;
      const TRANSFER_TIMEOUT_MS = Math.max(5 * 60 * 1000, (bytesToReceive / 40000) * 1000 * 1.5);
      const transferComplete = new Promise((resolve, reject) => {
        const transferTimer = setTimeout(() => reject(new Error("Timeout: Transfer nie zakończył się w czasie")), TRANSFER_TIMEOUT_MS);
        transferResolveRef.current = () => { clearTimeout(transferTimer); resolve(); };
        transferRejectRef.current = (err) => { clearTimeout(transferTimer); reject(err); };
      });

      sendData(deviceRef.current.address, `OK ${lastSavedTS} ${actualLocalSize}`);
      console.log('[TRANSFER] waiting for transferComplete...');
      await transferComplete;
      console.log('[TRANSFER] transferComplete resolved');
      isReceivingFileRef.current = false;
      console.log('[TRANSFER] flushBuffer start');
      await flushBuffer();
      console.log('[TRANSFER] flushBuffer done, waiting for fileWriteQueue...');
      await fileWriteQueue.current;
      console.log('[TRANSFER] fileWriteQueue done, reading full file for analysis.');

      showToast('Trwa analiza EKG...', 'analyzing');
      console.log('[TRANSFER] showToast analyzing called');

      const fileContent = await FileSystem.readAsStringAsync(FILE_URI, {
        encoding: FileSystem.EncodingType.UTF8
      });
      const parsedTrend = parseEcgFileToTrend(fileContent);
      trendRawRef.current = parsedTrend;

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
      if (!data || data.startsWith('Timestamp')) return;

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
        await RNFS.appendFile(FILE_URI.replace('file://', ''), dataToWrite, 'utf8');
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
      // Szybka ścieżka: jeśli mamy dane z poprzedniego transferu w pamięci
      if (trendRawRef.current.length > 0) {
        const lastMs = trendRawRef.current[trendRawRef.current.length - 1].timeMs;
        if (lastMs > 0) return String(lastMs);
      }

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
    const centerTime = Math.max(0, ep.start - 5000);

    snippets.push({
      title: `Ważne Zdarzenie #${index + 1}`,
      description: `Zgłoszenie pacjenta (zapis 10s przed naciśnięciem)`,
      time: formatMsToTime(ep.start),
      hr: ep.maxBpm || '--', 
      data: getEcgSlice(record.hourlyTrend, centerTime, 2500)
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

    await generatePdfReport(reportData, mode, emailData, showToast);
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
            showToast={showToast} saveToDownloads={(data) => saveToDownloads(data, showToast)} generatePdfReport={handleGeneratePdfReport}
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
              currentBpm={currentBpm}
              onBpmUpdate={setCurrentBpm}
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
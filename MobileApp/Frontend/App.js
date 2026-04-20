import React, { useState, useRef, useEffect } from 'react';
import { ScrollView, Animated, View, Text, TouchableOpacity, StatusBar, Platform } from 'react-native';
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

let Speech;
try {
  Speech = require('expo-speech');
} catch (e) {
  Speech = null;
}

const FILE_URI = FileSystem.documentDirectory + 'current_examination.csv';

export default function App() {
  const [view, setView] = useState('home'); 
  const [bleState, setBleState] = useState('disconnected'); 
  const [syncState, setSyncState] = useState('idle'); 

  const deviceRef = useRef(null);
  const subscriptionRef = useRef(null)
  
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
      if(!hasPermissions){
        showToast("Brak uprawnień Bluetooth.","error");
        return;
      }

      const paired = await getPairedDevices();
      const eros = paired.find(device => device.name === "EROS");
      if(!eros){
        showToast("Nie znaleziono urządzenia. Sparuj je w ustawieniach telefonu.","error");
        return;
      }

      const device = await connectToDevice(eros.address);
      if(!device){
        showToast("Nie udało połączyć się z urządzeniem.","error");
        return;
      }

      deviceRef.current = device;
      setBleState('connected');
      showToast('Nawiązano bezpieczne połączenie z EROS.');

      setIsLiveEcgActive(false);
      setLastConnectedTime(new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }));

      sendData(eros.address,"GET_STATE");
      subscriptionRef.current = receiveData(eros.address, (rawData) => {
        handleIncomingData(rawData);
      });

    } else {
      subscriptionRef.current?.remove();
      await disconnectDevice(deviceRef.current?.address);
      deviceRef.current=null;

      setBleState('disconnected');
      setSyncState('idle');
      showToast('Rozłączono urządzenie. Tryb odczytu lokalnego.', 'info');
      
      setIsLiveEcgActive(false);
    }
  };

  function handleIncomingData(rawData){
    try{
      const trimmed = rawData.trim();
      console.log(trimmed);
      if (!trimmed) return;

      if (trimmed === 'READY') {
        readyResolveRef.current?.();
        readyResolveRef.current = null;
        return;
      }

      if (trimmed.startsWith('E')){
        const sample = parseEcgPacket(trimmed);
        ecgBuffer.pushData(sample);
        return;
      }

      if(trimmed.startsWith('D')){
        parseDiagnostics(trimmed);
        return;
      }

      if(trimmed.startsWith('S')){
        console.log("STOPPING");
        transferResolveRef.current?.();
        transferResolveRef.current = null;
        isReceivingFileRef.current = false;
        return;
      }

      if(isReceivingFileRef.current){
        const line=parseFilePacket(trimmed);
        if(line && !isNaN(line.timestampMs)) writeToFile(line);
      }

    } catch(e) {
      console.warn('Failed to parse data from EROS:', rawData);
    }
  }

  function parseEcgPacket(trimmed){
    const sample = parseInt(trimmed.slice(1),10);
    if (!isNaN(sample)){
      return sample;
    }
  }

  function parseFilePacket(line){
    const values = line.trim().split(',');

    return {
      timestampMs: parseInt(values[0]),
      ECGRaw: parseInt(values[1]),
      BPM: parseInt(values[2]),
      leadOff: parseInt(values[3]),
    }
  }

  function parseDiagnostics(trimmed){
    const parsed = JSON.parse(trimmed.trim().slice(1));
    setDiagnostics({
      battery: parsed.battery,
      signalQuality: parsed.signalQuality,
      isMeasuring: parsed.isMeasuring,
      electrodes: Array.isArray(parsed.electrodes) ? parsed.electrodes: [],
    });
  }

  const syncData = () => {
    if (bleState !== 'connected') {
      showToast('Najpierw połącz urządzenie.', 'error');
      return;
    }
    setSyncState('syncing');
    
    setTimeout(() => {
      const newData = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        duration: "24:15:00",
        totalBeats: 102340, avgBpm: 71, minBpm: 48, minBpmTime: "05:22:10", maxBpm: 142, maxBpmTime: "16:40:05",
        veb: { total: 15, pairs: 1, runs: 0, burden: "< 0.1%" }, sveb: { total: 80, pairs: 3, runs: 0, burden: "0.1%" },
        pauses: { count: 0, longest: "1.9s", longestTime: "02:14:00" }, arrhythmiaEvents: 95, hourlyTrend: generateHourlyTrend(71)
      };
      
      setDeviceData(newData);
      setRecords(prev => [newData, ...prev]); 
      setSyncState('synced');
      setAiReport(null); 
      showToast('Dane pomyślnie zsynchronizowane.');
    }, 2500);
  };

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
      console.log("STOPPING3");
      const timeout = setTimeout(() => reject(new Error("Error: Transfer timeout")), 300000);
          transferResolveRef.current = () => {
            clearTimeout(timeout);
            resolve();
          };
    });

    sendData(deviceRef.current.address, `OK${lastSavedTS}`);
    console.log("STOPPING2");
    await transferComplete;
    console.log("STOPPING4");
    // // (Symulacja transferu pliku - do wywalenia potem)
    // await new Promise(resolve => setTimeout(resolve, 2000));
    // const fileInfo = await FileSystem.getInfoAsync(FILE_URI);
    // if (!fileInfo.exists) {
    //   console.log("Brak pliku badania, wstrzykuję plik testowy...");
    //   const [{ localUri }] = await Asset.loadAsync(require('./assets/test_ekg.csv'));
    //   await FileSystem.copyAsync({ from: localUri, to: FILE_URI });
    // }
    
    showToast('Trwa analiza EKG...', 'info');

    // const fileContent = await FileSystem.readAsStringAsync(FILE_URI, { 
    //   encoding: FileSystem.EncodingType.UTF8 
    // });

    const fileContent = await FileSystem.readAsStringAsync(FILE_URI);
    console.log("--- FULL FILE START ---");
    console.log(fileContent);
    console.log("--- FULL FILE END ---");

    const parsedTrend = parseEcgFileToTrend(fileContent);

    if (!parsedTrend || parsedTrend.length === 0) {
      showToast('Błąd: Plik jest pusty lub uszkodzony.', 'error');
      setSyncState('idle');
      return;
    }

    const allBpms = parsedTrend.map(d => d.bpm);
    const minBpm = Math.floor(Math.min(...allBpms));
    const maxBpm = Math.ceil(Math.max(...allBpms));
    const avgBpm = Math.round(allBpms.reduce((a, b) => a + b, 0) / allBpms.length);
    
    const lastTimeMs = parsedTrend[parsedTrend.length - 1].timeMs;
    const durationMins = Math.floor(lastTimeMs / 60000);
    const durationSecs = Math.floor((lastTimeMs % 60000) / 1000);

    const newData = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      duration: `${durationMins}m ${durationSecs}s`, 
      totalBeats: parsedTrend.length, 
      avgBpm: avgBpm, 
      minBpm: minBpm, 
      minBpmTime: "--:--:--", 
      maxBpm: maxBpm, 
      maxBpmTime: "--:--:--",
      veb: { total: 0, pairs: 0, runs: 0, burden: "0%" }, 
      sveb: { total: 0, pairs: 0, runs: 0, burden: "0%" },
      pauses: { count: 0, longest: "0", longestTime: "--" }, 
      arrhythmiaEvents: 0, 
      hourlyTrend: parsedTrend 
    };
    
    setDeviceData(newData);
    setRecords(prev => [newData, ...prev]); 
    setSyncState('synced');
    setAiReport(null); 
    showToast('Badanie odebrane i przeanalizowane!');

  } catch (error) {
    console.error("Błąd czytania pliku:", error);
    showToast('Wystąpił błąd podczas analizy pliku.', 'error');
    setSyncState('idle');
  }
  };

  const initFile = async() => {
    try{
      const fileInfo = await FileSystem.getInfoAsync(FILE_URI);
      if(!fileInfo.exists){
        await FileSystem.writeAsStringAsync(
          FILE_URI,
          'Timestamp_ms,ECG_raw,BPM,Lead_off\n',
          { encoding: FileSystem.EncodingType.UTF8 }
        );
      }
    } catch(error){
      console.error('Failed to initiate writing to file:',error);
    }
}

  const writeToFile = async({timestampMs, ECGRaw, BPM, leadOff}) => {
    try{
      const row = `${timestampMs},${ECGRaw},${BPM},${leadOff}\n`
      await FileSystem.writeAsStringAsync(FILE_URI, row, {
        encoding: FileSystem.EncodingType.UTF8,
        append: true,
      });
    } catch(error){
      console.error('Failed to write to file:',error);
    }
  }

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
    setActiveReportRecord(record);
    const snippets = [
      { title: "Tachykardia (Max HR)", description: `Max rytm: ${record.maxBpm} BPM.`, time: record.maxBpmTime, hr: record.maxBpm, data: generateMockEcgStrip('tachy') },
      { title: "Bradykardia (Min HR)", description: `Min rytm: ${record.minBpm} BPM.`, time: record.minBpmTime, hr: record.minBpm, data: generateMockEcgStrip('brady') }
    ];

    if (record.veb.total > 0) {
      snippets.push({ title: "Zdarzenie Ektopowe (VES)", description: "Zarejestrowane przedwczesne pobudzenie komorowe.", time: "18:45:12", hr: record.avgBpm + 5, data: generateMockEcgStrip('ves') });
    }
    if (record.pauses.count > 0) {
      snippets.push({ title: `Pauza (${record.pauses.longest})`, description: "Pauza przekraczająca normę.", time: record.pauses.longestTime, hr: record.minBpm - 10, data: generateMockEcgStrip('pause') });
    } else {
      snippets.push({ title: "Rytm Zatokowy", description: "Przykład dominującego rytmu.", time: "12:00:00", hr: record.avgBpm, data: generateMockEcgStrip('normal') });
    }

    setAiReport({
      date: new Date(record.date).toLocaleDateString('pl-PL'),
      summary: `Przeanalizowano ciągły zapis EKG. Zarejestrowano łącznie ${record.totalBeats.toLocaleString()} zespołów QRS. Średni rytm serca wynosił ${record.avgBpm} BPM.`,
      findings: [
        `Tętno: Max ${record.maxBpm} BPM, Min ${record.minBpm} BPM.`,
        `Aktywność komorowa: ${record.veb.total} pobudzeń przedwczesnych.`,
        `Aktywność nadkomorowa: ${record.sveb.total} pobudzeń przedwczesnych.`,
        record.pauses.count > 0 ? `Pauzy: Wykryto ${record.pauses.count} przerw > 2s.` : "Pauzy: Brak przerw > 2.0s."
      ],
      recommendation: `Wynik wymaga weryfikacji przez lekarza specjalistę! ${(record.veb.runs > 0 || record.pauses.count > 0) ? 'System wykrył złożone zaburzenia rytmu, wskazana pilna konsultacja.' : 'Nie wykryto bezpośrednich stanów zagrożenia życia.'}`,
      snippets: snippets
    });

    setView('report');
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
              syncData={syncData}
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
import React, { useState, useRef } from 'react';
import { ScrollView, Animated, View, Text, TouchableOpacity, StatusBar, Platform } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { AlertCircle, CheckCircle2, Home, History, Settings } from 'lucide-react-native';
import { styles } from './src/constants/Theme';
import { initialHistory, generateHourlyTrend, generateMockEcgStrip } from './src/utils/Generators';

import HomeScreen from './src/screens/HomeScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import ReportScreen from './src/screens/ReportScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { mockHardware } from './src/utils/MockHardware'; // tymczasowo

let Speech;
try {
  Speech = require('expo-speech');
} catch (e) {
  Speech = null;
}

export default function App() {
  const [view, setView] = useState('home'); 
  const [bleState, setBleState] = useState('disconnected'); 
  const [syncState, setSyncState] = useState('idle'); 
  
  const [records, setRecords] = useState(initialHistory);
  const [deviceData, setDeviceData] = useState(initialHistory[0]); 
  
  const [diagnostics, setDiagnostics] = useState({
    battery: 85,
    isMeasuring: true,
    signalQuality: "Stabilny",
    electrodes: [
      { name: "RA (Prawy)", ok: true },
      { name: "LA (Lewy)", ok: true },
      { name: "V1 (Klatka)", ok: true }
    ]
  });

  const [activeReportRecord, setActiveReportRecord] = useState(null);
  const [aiReport, setAiReport] = useState(null);
  const [doctorEmail, setDoctorEmail] = useState('');
  
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [isNotifEnabled, setIsNotifEnabled] = useState(true);
  const [isVibrateEnabled, setIsVibrateEnabled] = useState(true);

  const [toastMessage, setToastMessage] = useState(null);
  const toastAnim = useRef(new Animated.Value(200)).current;

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

  const toggleBluetooth = () => {
    if (bleState === 'disconnected') {
      setBleState('connected');
      showToast('Nawiązano bezpieczne połączenie z EROS PRO');

      mockHardware.start();

    } else {
      setBleState('disconnected');
      setSyncState('idle');
      showToast('Rozłączono urządzenie. Tryb odczytu lokalnego.', 'info');
      
      mockHardware.stop();
    }
  };

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
              bleState={bleState} deviceData={deviceData} syncState={syncState} 
              diagnostics={diagnostics} toggleBluetooth={toggleBluetooth} 
              syncData={syncData} openReport={openReport} formatDate={formatDate} 
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
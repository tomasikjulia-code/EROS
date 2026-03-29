import React, { useState, useRef, useEffect } from 'react';
import { 
  StyleSheet, Text, View, ScrollView, TouchableOpacity, 
  SafeAreaView, Animated, Dimensions, TextInput, Platform,
  StatusBar
} from 'react-native';
import { 
  Svg, Polyline, Defs, LinearGradient as SvgLinearGradient, Stop, Polygon, Circle, Line, Text as SvgText
} from 'react-native-svg';
import { 
  Activity, Bluetooth, BluetoothConnected, HeartPulse, 
  FileText, Send, Download, Mail, AlertCircle, RefreshCw, 
  CheckCircle2, ChevronLeft, BatteryMedium, Heart, Zap, 
  Clock, ShieldCheck, History, Calendar, ChevronRight,
  Home, Table2, Settings, Smartphone, Accessibility, Bell,
  Waves
} from 'lucide-react-native';

let Speech;
try {
  Speech = require('expo-speech');
} catch (e) {
  Speech = null;
}

const { width } = Dimensions.get('window');

const TrendChart = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <View style={[styles.chartContainer, styles.centerAll]}>
        <View style={styles.emptyIconBg}>
          <Activity color="#52525b" size={32} />
        </View>
        <Text style={styles.emptyTextTitle}>Brak danych z ostatnich 24h</Text>
        <Text style={styles.emptyTextSub}>Zsynchronizuj urządzenie, aby zobaczyć wykres</Text>
      </View>
    );
  }
  
  const chartHeight = 150;
  const chartWidth = 300;
  const paddingL = 35; 
  const paddingB = 25;
  
  const minBPM_val = Math.min(...data.map(d => d.bpm));
  const maxBPM_val = Math.max(...data.map(d => d.bpm));

  const yMin = Math.floor((minBPM_val - 10) / 10) * 10;
  const yMax = Math.ceil((maxBPM_val + 10) / 10) * 10;
  const yRange = yMax - yMin || 1;

  const getX = (index) => paddingL + (index / (data.length - 1)) * (chartWidth - paddingL - 10);
  const getY = (bpm) => (chartHeight - paddingB) - ((bpm - yMin) / yRange) * (chartHeight - paddingB - 20);

  const points = data.map((val, i) => `${getX(i)},${getY(val.bpm)}`).join(' ');
  const areaPoints = `${getX(0)},${chartHeight - paddingB} ${points} ${getX(data.length - 1)},${chartHeight - paddingB}`;

  const gridLinesY = [yMin, yMin + yRange / 2, yMax];

  return (
    <View style={styles.chartContainer}>
      <View style={styles.chartHeader}>
        <View style={styles.row}>
          <Activity color="#a78bfa" size={16} />
          <Text style={styles.chartTitle}>Trend dobowy tętna</Text>
        </View>
        <View style={styles.chartBadge}>
          <Text style={styles.chartBadgeText}>{minBPM_val} - {maxBPM_val} BPM</Text>
        </View>
      </View>
      
      <View style={styles.svgWrapper}>
        <Svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} width="100%" height="100%">
          <Defs>
            <SvgLinearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4" />
              <Stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
            </SvgLinearGradient>
          </Defs>

          {gridLinesY.map((bpm, i) => (
            <React.Fragment key={i}>
              <Line 
                x1={paddingL} y1={getY(bpm)} x2={chartWidth} y2={getY(bpm)} 
                stroke="#27272a" strokeWidth="1" strokeDasharray="4,4" 
              />
              <SvgText 
                x={paddingL - 8} y={getY(bpm) + 4} 
                fill="#a1a1aa" fontSize="10" fontWeight="bold" textAnchor="end"
              >
                {Math.round(bpm)}
              </SvgText>
            </React.Fragment>
          ))}
          
          {data.map((val, i) => {
             if (i % 3 === 0 || i === data.length - 1) {
               return (
                <SvgText 
                  key={i} x={getX(i)} y={chartHeight - 5} 
                  fill="#71717a" fontSize="9" fontWeight="600" textAnchor="middle"
                >
                  {val.time}
                </SvgText>
               );
             }
             return null;
          })}

          <Polygon points={areaPoints} fill="url(#chartGradient)" />
          
          <Polyline
            points={points}
            fill="none"
            stroke="#a78bfa"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {data.map((val, i) => (
            <Circle key={i} cx={getX(i)} cy={getY(val.bpm)} r="3" fill="#fff" />
          ))}
        </Svg>
      </View>
    </View>
  );
};

const EcgStrip = ({ title, description, time, hr, data }) => {
  const points = data.map((val, i) => `${i},${100 - val}`).join(' ');
  return (
    <View style={styles.ecgContainer}>
      <View style={styles.ecgHeader}>
        <View style={{ flex: 1 }}>
          <View style={styles.row}>
            <Activity size={16} color="#818cf8" />
            <Text style={styles.ecgTitle}>{title}</Text>
          </View>
          <Text style={styles.ecgDescription}>{description}</Text>
        </View>
        <View style={styles.ecgBadgesRow}>
           <View style={styles.ecgBadgeDark}>
             <Clock size={12} color="#d4d4d8"/> 
             <Text style={styles.ecgBadgeTextDark}>{time}</Text>
           </View>
           <View style={styles.ecgBadgeRose}>
             <Heart size={12} color="#fb7185"/> 
             <Text style={styles.ecgBadgeTextRose}>HR: {hr} bpm</Text>
           </View>
        </View>
      </View>
      <View style={styles.ecgSvgWrapper}>
        <Svg viewBox={`0 0 ${data.length} 200`} width="100%" height="100%" preserveAspectRatio="none">
          <Polyline points={points} fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinejoin="round" />
        </Svg>
      </View>
    </View>
  );
};

const DeviceDiagnostics = ({ bleState, diagnostics }) => {
  if (bleState !== 'connected') return null;

  return (
    <View style={styles.diagContainer}>
      <View style={[styles.row, { justifyContent: 'space-between', marginBottom: 16 }]}>
        <Text style={styles.diagMainTitle}>Diagnostyka Urządzenia</Text>
        <View style={styles.diagLiveBadge}>
          <View style={styles.dotPulseGreen} />
          <Text style={styles.diagLiveText}>NA ŻYWO</Text>
        </View>
      </View>

      <View style={styles.diagGrid}>
        <View style={styles.diagItem}>
          <BatteryMedium size={18} color={diagnostics.battery > 20 ? "#34d399" : "#fb7185"} />
          <Text style={styles.diagLabel}>Bateria</Text>
          <Text style={styles.diagValue}>{diagnostics.battery}%</Text>
        </View>
        <View style={styles.diagItem}>
          <Waves size={18} color="#60a5fa" />
          <Text style={styles.diagLabel}>Pomiar</Text>
          <Text style={styles.diagValue}>{diagnostics.isMeasuring ? "Aktywny" : "Pauza"}</Text>
        </View>
        <View style={styles.diagItem}>
          <Activity size={18} color="#a78bfa" />
          <Text style={styles.diagLabel}>Sygnał</Text>
          <Text style={styles.diagValue}>{diagnostics.signalQuality}</Text>
        </View>
      </View>

      <View style={styles.electrodesBox}>
        <Text style={styles.electrodesTitle}>Stan podpięcia elektrod:</Text>
        <View style={styles.row}>
          {diagnostics.electrodes.map((el, idx) => (
            <View key={idx} style={styles.electrodeItem}>
              <View style={[styles.electrodeDot, el.ok ? styles.bgEmerald : styles.bgRose]} />
              <Text style={styles.electrodeName}>{el.name}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

const generateMockEcgStrip = (type) => {
  const data = [];
  let cycleLength = 100;
  if (type === 'tachy') cycleLength = 55; 
  if (type === 'brady') cycleLength = 160; 

  for (let i = 0; i < 400; i++) {
    const t = i % cycleLength;
    let noise = Math.random() * 4 - 2;
    let val = noise;

    if (type === 'pause' && i > 120 && i < 280) {
      data.push(noise);
      continue;
    }

    if (t > 10 && t < 25) val = 15 * Math.sin((t - 10) * Math.PI / 15) + noise; 
    else if (t > 35 && t < 38) val = -15 + noise; 
    else if (t >= 38 && t < 42) val = 90 + noise; 
    else if (t >= 42 && t < 47) val = -25 + noise; 
    else if (t > 60 && t < 85) val = 25 * Math.sin((t - 60) * Math.PI / 25) + noise; 
    
    if (type === 'ves' && i >= 180 && i < 280) {
      if (t > 10 && t < 25) val = noise; 
      else if (t >= 25 && t < 55) val = -80 * Math.sin((t - 25) * Math.PI / 30) + noise; 
      else if (t > 55 && t < 90) val = 45 * Math.sin((t - 55) * Math.PI / 35) + noise; 
      else val = noise;
    }
    data.push(val);
  }
  return data;
};

const generateHourlyTrend = (baseBpm) => Array.from({ length: 12 }).map((_, i) => ({
  time: `${i * 2}:00`,
  bpm: Math.floor(baseBpm - 15 + Math.random() * 30)
}));

const initialHistory = [
  { 
    id: '1', date: new Date(Date.now() - 86400000).toISOString(), duration: "23:50:12", 
    totalBeats: 98450, avgBpm: 68, minBpm: 46, minBpmTime: "04:12:05", maxBpm: 128, maxBpmTime: "14:45:22",
    veb: { total: 12, pairs: 0, runs: 0, burden: "< 0.1%" }, sveb: { total: 45, pairs: 2, runs: 0, burden: "0.1%" },
    pauses: { count: 0, longest: "1.8s", longestTime: "03:15:00" }, arrhythmiaEvents: 57, hourlyTrend: generateHourlyTrend(68) 
  },
  { 
    id: '2', date: new Date(Date.now() - 86400000 * 5).toISOString(), duration: "24:00:00", 
    totalBeats: 105600, avgBpm: 74, minBpm: 52, minBpmTime: "02:30:10", maxBpm: 155, maxBpmTime: "17:20:45", 
    veb: { total: 245, pairs: 12, runs: 1, burden: "0.2%" }, sveb: { total: 112, pairs: 5, runs: 2, burden: "0.1%" },
    pauses: { count: 2, longest: "2.6s", longestTime: "04:10:15" }, arrhythmiaEvents: 357, hourlyTrend: generateHourlyTrend(74) 
  }
];

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
    } else {
      setBleState('disconnected');
      setSyncState('idle');
      showToast('Rozłączono urządzenie. Tryb odczytu lokalnego.', 'info');
    }
  };

  const syncData = () => {
    if (bleState !== 'connected') {
      showToast('Najpierw połącz urządzenie', 'error');
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
      showToast('Dane pomyślnie zsynchronizowane z chmurą');
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

  const renderHome = () => (
    <View style={styles.screenContent}>
      <View style={styles.topBar}>
        <View style={styles.row}>
          <View style={styles.logoIcon}><HeartPulse color="#fff" size={24} /></View>
          <View><Text style={styles.logoText}>EROS</Text><Text style={styles.logoSubtext}>MOBILE SYNC</Text></View>
        </View>
        <TouchableOpacity onPress={toggleBluetooth} style={[styles.btnBluetooth, bleState === 'connected' && styles.btnBluetoothActive]}>
          {bleState === 'connected' ? <BluetoothConnected size={22} color="#818cf8" /> : <Bluetooth size={22} color="#71717a" />}
        </TouchableOpacity>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View>
            {bleState === 'connected' ? (
              <View style={[styles.badge, styles.badgeBlue]}><View style={styles.dotPulse} /><Text style={styles.badgeTextBlue}>Połączono z Holterem</Text></View>
            ) : deviceData ? (
              <View style={[styles.badge, styles.badgeEmerald]}><CheckCircle2 size={12} color="#34d399" /><Text style={styles.badgeTextEmerald}>Tryb Offline (Ostatni)</Text></View>
            ) : (
              <View style={[styles.badge, styles.badgeZinc]}><AlertCircle size={12} color="#a1a1aa" /><Text style={styles.badgeTextZinc}>Brak danych</Text></View>
            )}
            <View style={[styles.row, {marginTop: 8}]}>
              {bleState === 'connected' ? (
                <><BatteryMedium size={14} color="#34d399"/><Text style={styles.subText}>EROS PRO v2.1</Text></>
              ) : deviceData ? (
                <><Clock size={12} color="#a1a1aa"/><Text style={styles.subText}>{formatDate(deviceData.date)}</Text></>
              ) : <Text style={styles.subText}>Urządzenie niepołączone</Text>}
            </View>
          </View>
          <TouchableOpacity onPress={syncData} disabled={syncState === 'syncing' || bleState === 'disconnected'} style={[styles.btnSync, (syncState === 'syncing' || bleState === 'disconnected') && styles.btnSyncDisabled]}>
             <RefreshCw size={20} color={bleState === 'disconnected' ? '#52525b' : '#fff'} />
          </TouchableOpacity>
        </View>
        <View style={styles.heroMain}>
          <Text style={styles.heroBpmText}>{deviceData?.avgBpm || '--'}</Text>
          <View style={{paddingBottom: 8}}><Text style={styles.heroBpmLabel}>BPM</Text><Text style={styles.heroBpmSublabel}>Średnio</Text></View>
        </View>
      </View>

      <DeviceDiagnostics bleState={bleState} diagnostics={diagnostics} />

      <View style={styles.statsGrid}>
        <View style={styles.statCard}><View style={styles.statIconBg}><Clock size={18} color="#60a5fa" /></View><View><Text style={styles.statValue}>{deviceData?.duration.substring(0,5) || '--'}</Text><Text style={styles.statLabel}>Czas zapisu</Text></View></View>
        <View style={styles.statCard}><View style={styles.statIconBg}><AlertCircle size={18} color="#fb7185" /></View><View><Text style={styles.statValue}>{deviceData?.arrhythmiaEvents ?? '--'} <Text style={styles.statUnit}>{deviceData ? 'zdarzeń' : ''}</Text></Text><Text style={styles.statLabel}>Epizody Arytmii</Text></View></View>
        <View style={styles.statCard}><View style={styles.statIconBg}><Heart size={18} color="#34d399" /></View><View><Text style={styles.statValue}>{deviceData?.minBpm || '--'} <Text style={styles.statUnit}>{deviceData ? 'BPM' : ''}</Text></Text><Text style={styles.statLabel}>Najniższe Tętno</Text></View></View>
        <View style={styles.statCard}><View style={styles.statIconBg}><Zap size={18} color="#fbbf24" /></View><View><Text style={styles.statValue}>{deviceData?.maxBpm || '--'} <Text style={styles.statUnit}>{deviceData ? 'BPM' : ''}</Text></Text><Text style={styles.statLabel}>Najwyższe Tętno</Text></View></View>
      </View>

      <View style={{marginTop: 16}}><TrendChart data={deviceData?.hourlyTrend} /></View>

      <View style={styles.bottomAction}>
        <TouchableOpacity onPress={() => openReport(deviceData)} disabled={!deviceData} style={[styles.btnPrimary, !deviceData && styles.btnPrimaryDisabled]}>
          <ShieldCheck size={22} color={deviceData ? "#c7d2fe" : "#52525b"} />
          <Text style={[styles.btnPrimaryText, !deviceData && styles.btnPrimaryTextDisabled]}>Otwórz Raport Kliniczny</Text>
          {deviceData && <ChevronRight size={18} color="#818cf8" style={{position: 'absolute', right: 20}} />}
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderHistory = () => (
    <View style={styles.screenContent}>
      <View style={styles.pageHeader}><Text style={styles.pageTitle}>Archiwum</Text><Text style={styles.pageSubtitle}>Zapisane pełne wyniki pomiarów EROS.</Text></View>
      {records.length === 0 ? (
        <View style={[styles.chartContainer, styles.centerAll, {marginTop: 20, paddingVertical: 40}]}><Calendar color="#52525b" size={40} style={{marginBottom: 16}} /><Text style={styles.emptyTextTitle}>Brak zapisanych pomiarów</Text></View>
      ) : (
        records.map((record) => (
          <TouchableOpacity key={record.id} onPress={() => openReport(record)} style={styles.historyCard} activeOpacity={0.7}>
            <View style={styles.row}><View style={styles.historyIconBg}><FileText size={22} color="#818cf8" /></View><View style={{marginLeft: 12}}><Text style={styles.historyDate}>{formatDate(record.date)}</Text><View style={[styles.row, {marginTop: 6, gap: 12}]}><View style={styles.historyBadge}><Clock size={12} color="#60a5fa"/><Text style={styles.historyBadgeText}>{record.duration.substring(0,5)}h</Text></View><View style={styles.historyBadge}><Heart size={12} color="#fb7185"/><Text style={styles.historyBadgeText}>{record.avgBpm} BPM</Text></View></View></View></View>
            <View style={styles.row}>{(record.veb.total > 100 || record.pauses.count > 0) && (<View style={styles.historyAlertBadge}><AlertCircle size={16} color="#fb7185" /></View>)}<ChevronRight size={20} color="#52525b" /></View>
          </TouchableOpacity>
        ))
      )}
    </View>
  );

  const renderSettings = () => (
    <View style={styles.screenContent}>
      <View style={styles.pageHeader}><Text style={styles.pageTitle}>Ustawienia</Text><Text style={styles.pageSubtitle}>Dostosuj aplikację do swoich potrzeb.</Text></View>
      
      <Text style={styles.sectionTitle}>DOSTĘPNOŚĆ (ACCESSIBILITY)</Text>
      <View style={styles.settingCard}>
        <View style={styles.settingRow}>
          <View style={styles.row}>
            <View style={[styles.settingIconBg, isVoiceEnabled && styles.settingIconBgActive]}>
              <Accessibility size={22} color={isVoiceEnabled ? "#818cf8" : "#a1a1aa"} />
            </View>
            <View style={{marginLeft: 12}}>
              <Text style={styles.settingTitle}>Asystent Głosowy</Text>
              <Text style={styles.settingSub}>Odczytuje powiadomienia na głos.</Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleVoiceToggle} style={[styles.toggleTrack, isVoiceEnabled && styles.toggleTrackActive]}>
            <View style={[styles.toggleThumb, isVoiceEnabled && styles.toggleThumbActive]} />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={[styles.sectionTitle, {marginTop: 24}]}>POWIADOMIENIA I SYSTEM</Text>
      <View style={styles.settingCard}>
        <View style={[styles.settingRow, styles.settingBorderBottom]}>
          <View style={styles.row}>
            <View style={[styles.settingIconBg, isNotifEnabled && {backgroundColor: 'rgba(59,130,246,0.15)'}]}>
              <Bell size={22} color={isNotifEnabled ? "#60a5fa" : "#a1a1aa"} />
            </View>
            <View style={{marginLeft: 12}}>
              <Text style={styles.settingTitle}>Powiadomienia Push</Text>
              <Text style={styles.settingSub}>Alert o nowym raporcie.</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setIsNotifEnabled(!isNotifEnabled)} style={[styles.toggleTrack, isNotifEnabled && {backgroundColor: '#2563eb', borderColor: '#3b82f6'}]}>
            <View style={[styles.toggleThumb, isNotifEnabled && styles.toggleThumbActive]} />
          </TouchableOpacity>
        </View>
        <View style={styles.settingRow}>
          <View style={styles.row}>
            <View style={[styles.settingIconBg, isVibrateEnabled && {backgroundColor: 'rgba(16,185,129,0.15)'}]}>
              <Smartphone size={22} color={isVibrateEnabled ? "#34d399" : "#a1a1aa"} />
            </View>
            <View style={{marginLeft: 12}}>
              <Text style={styles.settingTitle}>Wibracje</Text>
              <Text style={styles.settingSub}>Haptyka przy akcjach systemu.</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setIsVibrateEnabled(!isVibrateEnabled)} style={[styles.toggleTrack, isVibrateEnabled && {backgroundColor: '#059669', borderColor: '#10b981'}]}>
            <View style={[styles.toggleThumb, isVibrateEnabled && styles.toggleThumbActive]} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderReport = () => {
    if (!activeReportRecord) return null; 
    return (
      <View style={styles.screenContent}>
        <View style={styles.reportNavRow}><TouchableOpacity onPress={() => setView('home')} style={styles.btnBack}><ChevronLeft size={20} color="#a1a1aa" /><Text style={styles.btnBackText}>Wróć</Text></TouchableOpacity><View style={styles.patientBadge}><Text style={styles.patientBadgeText}>KARTA PACJENTA</Text></View></View>
        <View style={styles.reportCard}>
          <View style={styles.reportHeader}><View style={styles.row}><FileText size={24} color="#6366f1" /><Text style={styles.reportTitle}>Kliniczny Raport Holter</Text></View><View style={[styles.row, {marginTop: 12, gap: 16}]}><View style={styles.row}><Calendar size={14} color="#71717a"/><Text style={styles.reportSub}> {formatDate(activeReportRecord.date)}</Text></View><View style={styles.row}><Clock size={14} color="#71717a"/><Text style={styles.reportSub}> {activeReportRecord.duration}</Text></View></View></View>
          <View style={styles.tableCard}><View style={styles.tableHeader}><Table2 size={16} color="#818cf8" /><Text style={styles.tableHeaderText}>ZESTAWIENIE ZDARZEŃ</Text></View><View style={styles.tableRow}><Text style={styles.tableCellLabel}>Całkowita liczba QRS</Text><Text style={styles.tableCellValue}>{activeReportRecord.totalBeats.toLocaleString()}</Text></View><View style={styles.tableRow}><Text style={styles.tableCellLabel}>Arytmie Nadkomorowe</Text><Text style={styles.tableCellValue}>{activeReportRecord.sveb.total}</Text></View><View style={styles.tableRow}><Text style={styles.tableCellLabel}>Arytmie Komorowe</Text><Text style={styles.tableCellValue}>{activeReportRecord.veb.total}</Text></View><View style={[styles.tableRow, {borderBottomWidth: 0}]}><Text style={styles.tableCellLabel}>Pauzy RR {'>'} 2.0s</Text><Text style={styles.tableCellValue}>{activeReportRecord.pauses.count}</Text></View></View>
          <TrendChart data={activeReportRecord.hourlyTrend} />
          <View style={{marginTop: 32}}><View style={styles.row}><View style={styles.iconBgEmerald}><Activity size={18} color="#34d399"/></View><Text style={styles.sectionTitleAi}>Interpretacja Algorytmu AI</Text></View>
             {aiReport && (
               <>
                 <View style={styles.aiBox}><Text style={styles.aiText}>{aiReport.summary}</Text></View>
                 <View style={styles.aiBox}><Text style={styles.aiBoxTitle}>Szczegółowe Wnioski:</Text>{aiReport.findings.map((finding, idx) => (<View key={idx} style={styles.aiListItem}><CheckCircle2 size={16} color="#34d399" /><Text style={styles.aiListText}>{finding}</Text></View>))}</View>
                 <View style={{marginTop: 24}}><View style={[styles.row, {marginBottom: 16}]}><Activity size={20} color="#fb7185" /><Text style={[styles.sectionTitleAi, {marginLeft: 8}]}>Wycinki EKG</Text></View>{aiReport.snippets.map((snippet, idx) => (<EcgStrip key={idx} title={snippet.title} description={snippet.description} time={snippet.time} hr={snippet.hr} data={snippet.data} />))}</View>
                 <View style={styles.warningBox}><View style={styles.row}><AlertCircle size={16} color="#fb7185" /><Text style={styles.warningTitle}>Ważna uwaga medyczna:</Text></View><Text style={styles.warningText}>{aiReport.recommendation}</Text></View>
               </>
             )}
          </View>
        </View>
        {aiReport && (
          <View style={{marginTop: 24, paddingHorizontal: 4}}><TouchableOpacity onPress={() => showToast("Zapisywanie pliku PDF...", "info")} style={styles.btnSecondary}><Download size={20} color="#fff" /><Text style={styles.btnSecondaryText}>Zapisz dokument PDF</Text></TouchableOpacity><View style={styles.emailForm}><Mail size={20} color="#71717a" style={{marginLeft: 16}} /><TextInput style={styles.input} placeholder="E-mail lekarza kardiologa" placeholderTextColor="#71717a" value={doctorEmail} onChangeText={setDoctorEmail} keyboardType="email-address" /><TouchableOpacity onPress={() => { setDoctorEmail(''); showToast("Zaszyfrowany raport wysłany!"); }} style={styles.btnSend}><Send size={18} color="#fff" /></TouchableOpacity></View></View>
        )}
      </View>
    );
  };

  const ToastIcon = toastMessage?.type === 'error' ? AlertCircle : CheckCircle2;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {view === 'home' && renderHome()}
        {view === 'history' && renderHistory()}
        {view === 'report' && renderReport()}
        {view === 'settings' && renderSettings()}
      </ScrollView>
      <View style={styles.bottomNav}><TouchableOpacity style={styles.navItem} onPress={() => setView('home')}><Home size={22} color={view === 'home' ? '#818cf8' : '#71717a'} /><Text style={[styles.navText, view === 'home' && styles.navTextActive]}>PULPIT</Text></TouchableOpacity><TouchableOpacity style={styles.navItem} onPress={() => setView('history')}><History size={22} color={view === 'history' ? '#818cf8' : '#71717a'} /><Text style={[styles.navText, view === 'history' && styles.navTextActive]}>HISTORIA</Text></TouchableOpacity><TouchableOpacity style={styles.navItem} onPress={() => setView('settings')}><Settings size={22} color={view === 'settings' ? '#818cf8' : '#71717a'} /><Text style={[styles.navText, view === 'settings' && styles.navTextActive]}>OPCJE</Text></TouchableOpacity></View>
      <Animated.View style={[styles.toast, toastMessage?.type === 'error' ? styles.toastError : toastMessage?.type === 'info' ? styles.toastInfo : styles.toastSuccess, { transform: [{ translateY: toastAnim }] }]}>
        {toastMessage && <ToastIcon size={20} color={toastMessage.type === 'error' ? "#fb7185" : "#34d399"} />}
        <Text style={styles.toastText}>{toastMessage?.message}</Text>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#09090b',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 8 : 0 
  },
  scrollView: { flex: 1 },
  scrollContent: { 
    padding: 16, 
    paddingBottom: Platform.OS === 'ios' ? 120 : 100, 
    flexGrow: 1 
  },
  screenContent: { flex: 1, display: 'flex', flexDirection: 'column' },
  row: { flexDirection: 'row', alignItems: 'center' },
  centerAll: { alignItems: 'center', justifyContent: 'center' },
  bgEmerald: { backgroundColor: '#10b981' },
  bgRose: { backgroundColor: '#f43f5e' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  logoIcon: { backgroundColor: '#6366f1', padding: 10, borderRadius: 16, marginRight: 12 },
  logoText: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  logoSubtext: { color: '#a1a1aa', fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  btnBluetooth: { padding: 12, backgroundColor: 'rgba(39, 39, 42, 0.6)', borderRadius: 16, borderWidth: 1, borderColor: '#27272a' },
  btnBluetoothActive: { backgroundColor: 'rgba(99, 102, 241, 0.1)', borderColor: 'rgba(99, 102, 241, 0.3)' },
  heroCard: { backgroundColor: 'rgba(24, 24, 27, 0.8)', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#27272a', marginBottom: 16 },
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1 },
  badgeBlue: { backgroundColor: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.2)' },
  badgeEmerald: { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)' },
  badgeZinc: { backgroundColor: 'rgba(63, 63, 70, 0.5)', borderColor: '#3f3f46' },
  dotPulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3b82f6', marginRight: 8 },
  badgeTextBlue: { color: '#60a5fa', fontSize: 12, fontWeight: '700' },
  badgeTextEmerald: { color: '#34d399', fontSize: 12, fontWeight: '700', marginLeft: 6 },
  badgeTextZinc: { color: '#a1a1aa', fontSize: 12, fontWeight: '700', marginLeft: 6 },
  subText: { color: '#a1a1aa', fontSize: 12, marginLeft: 6, fontWeight: '500' },
  btnSync: { backgroundColor: '#4f46e5', padding: 14, borderRadius: 16 },
  btnSyncDisabled: { backgroundColor: '#27272a' },
  heroMain: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  heroBpmText: { color: '#fff', fontSize: 64, fontWeight: '900', letterSpacing: -2, lineHeight: 70 },
  heroBpmLabel: { color: '#a1a1aa', fontSize: 16, fontWeight: '700' },
  heroBpmSublabel: { color: '#71717a', fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
  diagContainer: { backgroundColor: 'rgba(39, 39, 42, 0.3)', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#27272a', marginBottom: 20 },
  diagMainTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  diagLiveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  diagLiveText: { color: '#34d399', fontSize: 10, fontWeight: '900', marginLeft: 6 },
  dotPulseGreen: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  diagGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  diagItem: { alignItems: 'center', flex: 1 },
  diagLabel: { color: '#71717a', fontSize: 10, fontWeight: '600', marginTop: 4, textTransform: 'uppercase' },
  diagValue: { color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 2 },
  electrodesBox: { borderTopWidth: 1, borderTopColor: '#27272a', paddingTop: 16 },
  electrodesTitle: { color: '#a1a1aa', fontSize: 12, fontWeight: '600', marginBottom: 12 },
  electrodeItem: { flexDirection: 'row', alignItems: 'center', marginRight: 16 },
  electrodeDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  electrodeName: { color: '#d4d4d8', fontSize: 11, fontWeight: '500' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  statCard: { width: '48%', backgroundColor: 'rgba(24, 24, 27, 0.6)', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#27272a', justifyContent: 'space-between' },
  statIconBg: { backgroundColor: '#27272a', padding: 8, borderRadius: 12, alignSelf: 'flex-start', marginBottom: 12 },
  statValue: { color: '#fff', fontSize: 20, fontWeight: '900' },
  statUnit: { color: '#71717a', fontSize: 12, fontWeight: '600' },
  statLabel: { color: '#a1a1aa', fontSize: 11, fontWeight: '500', marginTop: 4 },
  chartContainer: { backgroundColor: 'rgba(24, 24, 27, 0.6)', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#27272a', height: 240 }, 
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  chartTitle: { color: '#d4d4d8', fontSize: 13, fontWeight: '600', marginLeft: 8 },
  chartBadge: { backgroundColor: 'rgba(139, 92, 246, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  chartBadgeText: { color: '#c4b5fd', fontSize: 11, fontWeight: '700' },
  svgWrapper: { flex: 1, overflow: 'visible' },
  emptyIconBg: { backgroundColor: '#27272a', padding: 16, borderRadius: 30, marginBottom: 12 },
  emptyTextTitle: { color: '#a1a1aa', fontSize: 14, fontWeight: '600' },
  emptyTextSub: { color: '#71717a', fontSize: 12, marginTop: 4 },
  bottomAction: { marginTop: 'auto', paddingTop: 32 },
  btnPrimary: { backgroundColor: '#4f46e5', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 18, borderRadius: 20, gap: 12 },
  btnPrimaryDisabled: { backgroundColor: '#27272a' },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnPrimaryTextDisabled: { color: '#52525b' },
  btnSecondary: { backgroundColor: '#27272a', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#3f3f46' },
  btnSecondaryText: { color: '#fff', fontSize: 14, fontWeight: '700', marginLeft: 8 },
  pageHeader: { marginBottom: 24, marginTop: 8 },
  pageTitle: { color: '#fff', fontSize: 28, fontWeight: '900' },
  pageSubtitle: { color: '#a1a1aa', fontSize: 13, marginTop: 4 },
  historyCard: { backgroundColor: 'rgba(24, 24, 27, 0.6)', borderWidth: 1, borderColor: '#27272a', borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  historyIconBg: { backgroundColor: '#27272a', padding: 12, borderRadius: 14 },
  historyDate: { color: '#f4f4f5', fontSize: 16, fontWeight: '700' },
  historyBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#27272a', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  historyBadgeText: { color: '#a1a1aa', fontSize: 11, fontWeight: '600', marginLeft: 4 },
  historyAlertBadge: { backgroundColor: 'rgba(244, 63, 94, 0.1)', padding: 6, borderRadius: 10, marginRight: 8 },
  sectionTitle: { color: '#71717a', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginLeft: 8, marginBottom: 12 },
  settingCard: { backgroundColor: 'rgba(24, 24, 27, 0.6)', borderRadius: 20, borderWidth: 1, borderColor: '#27272a', paddingHorizontal: 16, marginBottom: 16, overflow: 'hidden' },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, minHeight: 64 },
  settingBorderBottom: { borderBottomWidth: 1, borderBottomColor: '#27272a' },
  settingIconBg: { padding: 10, borderRadius: 12, backgroundColor: '#27272a' },
  settingIconBgActive: { backgroundColor: 'rgba(99, 102, 241, 0.2)' },
  settingTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  settingSub: { color: '#a1a1aa', fontSize: 12, marginTop: 2 },
  toggleTrack: { width: 44, height: 26, borderRadius: 13, backgroundColor: '#27272a', borderWidth: 1, borderColor: '#3f3f46', justifyContent: 'center', padding: 2 },
  toggleTrackActive: { backgroundColor: '#4f46e5', borderColor: '#6366f1' },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  toggleThumbActive: { transform: [{ translateX: 18 }] },
  reportNavRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  btnBack: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#18181b', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#27272a' },
  btnBackText: { color: '#a1a1aa', fontWeight: '600', marginLeft: 4 },
  patientBadge: { backgroundColor: '#18181b', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#27272a' },
  patientBadgeText: { color: '#71717a', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  reportCard: { backgroundColor: 'rgba(24, 24, 27, 0.8)', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#27272a' },
  reportHeader: { borderBottomWidth: 1, borderBottomColor: '#27272a', paddingBottom: 20, marginBottom: 20 },
  reportTitle: { color: '#fff', fontSize: 22, fontWeight: '900', marginLeft: 12 },
  reportSub: { color: '#a1a1aa', fontSize: 13, fontWeight: '500' },
  tableCard: { backgroundColor: '#18181b', borderRadius: 16, borderWidth: 1, borderColor: '#27272a', overflow: 'hidden', marginBottom: 24 },
  tableHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#27272a', padding: 12 },
  tableHeaderText: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginLeft: 8 },
  tableRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderBottomColor: '#27272a' },
  tableCellLabel: { color: '#a1a1aa', fontSize: 13 },
  tableCellValue: { color: '#fff', fontSize: 14, fontWeight: '700' },
  sectionTitleAi: { color: '#fff', fontSize: 18, fontWeight: '700', marginLeft: 12 },
  iconBgEmerald: { backgroundColor: 'rgba(52, 211, 153, 0.1)', padding: 6, borderRadius: 8 },
  aiBox: { backgroundColor: 'rgba(39, 39, 42, 0.4)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#27272a', marginTop: 16 },
  aiText: { color: '#d4d4d8', fontSize: 13, lineHeight: 20 },
  aiBoxTitle: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 12 },
  aiListItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  aiListText: { color: '#d4d4d8', fontSize: 13, marginLeft: 8, flex: 1 },
  warningBox: { backgroundColor: 'rgba(244, 63, 94, 0.1)', borderRadius: 16, padding: 16, borderLeftWidth: 4, borderLeftColor: '#f43f5e', marginTop: 24 },
  warningTitle: { color: '#fb7185', fontSize: 13, fontWeight: '700', marginLeft: 8 },
  warningText: { color: '#fecdd3', fontSize: 13, marginTop: 8, lineHeight: 20 },
  ecgContainer: { marginBottom: 24 },
  ecgHeader: { marginBottom: 12 },
  ecgTitle: { color: '#fff', fontSize: 14, fontWeight: '700', marginLeft: 8 },
  ecgDescription: { color: '#a1a1aa', fontSize: 11, marginTop: 4 },
  ecgBadgesRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  ecgBadgeDark: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#27272a', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  ecgBadgeTextDark: { color: '#d4d4d8', fontSize: 11, fontWeight: '600', marginLeft: 4 },
  ecgBadgeRose: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(244, 63, 94, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  ecgBadgeTextRose: { color: '#fb7185', fontSize: 11, fontWeight: '600', marginLeft: 4 },
  ecgSvgWrapper: { height: 140, backgroundColor: '#09090b', borderRadius: 16, borderWidth: 1, borderColor: '#27272a', overflow: 'hidden' },
  emailForm: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#18181b', borderRadius: 16, borderWidth: 1, borderColor: '#27272a' },
  input: { flex: 1, color: '#fff', paddingVertical: 14, paddingHorizontal: 12, fontSize: 14 },
  btnSend: { backgroundColor: '#4f46e5', padding: 14, borderRadius: 12, margin: 4 },
  bottomNav: { position: 'absolute', bottom: 0, width: '100%', flexDirection: 'row', backgroundColor: 'rgba(9, 9, 11, 0.95)', borderTopWidth: 1, borderTopColor: '#27272a', paddingBottom: Platform.OS === 'ios' ? 24 : 16, paddingTop: 12 },
  navItem: { flex: 1, alignItems: 'center' },
  navText: { color: '#71717a', fontSize: 10, fontWeight: '700', marginTop: 4, letterSpacing: 0.5 },
  navTextActive: { color: '#818cf8' },
  toast: { position: 'absolute', bottom: Platform.OS === 'ios' ? 100 : 80, left: 20, right: 20, backgroundColor: '#18181b', flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#27272a', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 15, elevation: 10 },
  toastError: { backgroundColor: '#4c0519', borderColor: '#881337' },
  toastSuccess: { backgroundColor: '#022c22', borderColor: '#064e3b' },
  toastInfo: { backgroundColor: '#18181b', borderColor: '#27272a' },
  toastText: { color: '#fff', fontSize: 13, fontWeight: '500', marginLeft: 12, flex: 1 },
});
import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { 
  HeartPulse, Bluetooth, BluetoothConnected, CheckCircle2, 
  AlertCircle, BatteryMedium, Clock, RefreshCw, Heart, 
  Zap, ShieldCheck, ChevronRight, Activity, FileDown, Database, Trash2
} from 'lucide-react-native';

import { styles } from '../constants/Theme';
import DeviceDiagnostics from '../components/DeviceDiagnostics';
import TrendChart from '../components/TrendChart';
import LiveEcgChart from '../components/LiveEcgChart'; 
import ActivityChart from '../components/ActivityChart';

const HomeScreen = ({ 
  bleState, 
  deviceData, 
  syncState, 
  diagnostics, 
  toggleBluetooth, 
  refreshDiagnostics, 
  openReport, 
  formatDate,
  toggleLiveEcg,
  isLiveEcgActive,
  getFileFromDevice, 
  lastConnectedTime,
  deleteCurrentFile,
  loadMockReport,
  currentBpm
}) => {

  const confirmDelete = () => {
    Alert.alert(
      "Usuń badanie",
      "Czy na pewno chcesz trwale usunąć aktualne badanie z pamięci telefonu?",
      [
        { text: "Anuluj", style: "cancel" },
        { text: "Usuń", style: "destructive", onPress: deleteCurrentFile }
      ]
    );
  };

  // Logika blokowania przycisków
  const isLiveButtonDisabled = bleState !== 'connected' || syncState === 'syncing';
  const isDownloadButtonDisabled = bleState !== 'connected' || syncState === 'syncing' || isLiveEcgActive;

  // Logika wyświetlania BPM
  const displayBpm = currentBpm || '--';
  const isDisconnectedOrEmpty = !isLiveEcgActive;

  return (
    <View style={styles.screenContent}>

      <View style={styles.topBar}>
        <View style={styles.row}>
          <View style={styles.logoIcon}>
            <HeartPulse color="#fff" size={24} />
          </View>
          <View>
            <Text style={styles.logoText}>RYTHMIO</Text>
            <Text style={styles.logoSubtext}>Holter EKG</Text>
          </View>
        </View>
        <TouchableOpacity 
          onPress={toggleBluetooth} 
          style={[styles.btnBluetooth, bleState === 'connected' && styles.btnBluetoothActive]}
        >
          {bleState === 'connected' ? (
            <BluetoothConnected size={22} color="#818cf8" />
          ) : (
            <Bluetooth size={22} color="#71717a" />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.heroCard}>
        
        {/* GÓRNY WIERSZ (Status + Odśwież) */}
        <View style={styles.heroHeader}>
          <View>
            {bleState === 'connected' ? (
              <View style={[styles.badge, styles.badgeBlue]}>
                <View style={styles.dotPulse} />
                <Text style={styles.badgeTextBlue}>
                  {isLiveEcgActive ? 'Monitorowanie na żywo' : 'Połączono z urządzeniem'}
                </Text>
              </View>
            ) : (
              <View style={[styles.badge, styles.badgeZinc]}>
                <AlertCircle size={12} color="#a1a1aa" />
                <Text style={styles.badgeTextZinc}>Tryb Offline</Text>
              </View>
            )}
            
            <View style={[styles.row, { marginTop: 8 }]}>
               <Clock size={12} color="#a1a1aa"/>
               <Text style={styles.subText}>
                 {deviceData ? formatDate(deviceData.date) : 'Brak badania'}
                 {lastConnectedTime && ` • Widziano: ${lastConnectedTime}`}
               </Text>
            </View>
          </View>
          
          <TouchableOpacity 
            onPress={refreshDiagnostics} 
            disabled={bleState === 'disconnected'} 
            style={[styles.btnSync, bleState === 'disconnected' && styles.btnSyncDisabled]}
          >
             <RefreshCw
               size={20}
               color={bleState === 'disconnected' ? '#52525b' : '#fff'}
               style={{ opacity: syncState === 'syncing' ? 0.4 : 1 }}
             />
          </TouchableOpacity>
        </View>
        
        {/* DOLNY WIERSZ (BPM + Kosz) */}
        <View style={[styles.heroMain, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
          
          {/* Sekcja BPM - dynamicznie zmienia styl i wartość */}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.heroBpmText, isDisconnectedOrEmpty && { color: '#71717a' }]}>
              {displayBpm}
            </Text>
            
            {/* Lekko spychamy prawy blok w dół, aby optycznie wyrównać go z kreskami "--" */}
            <View style={{ marginLeft: 8, justifyContent: 'center', marginTop: 8 }}>
              <Text style={[styles.heroBpmLabel, isDisconnectedOrEmpty && { color: '#71717a' }]}>
                BPM
              </Text>
              {isLiveEcgActive && (
                <Text style={[styles.heroBpmSublabel, isDisconnectedOrEmpty && { color: '#52525b' }]}>
                </Text>
              )}
            </View>
          </View>

          <TouchableOpacity 
            onPress={confirmDelete}
            disabled={!deviceData}
            style={[styles.btnSync, !deviceData && styles.btnSyncDisabled]}
          >
            <Trash2 size={20} color={deviceData ? "#fb7185" : "#52525b"} />
          </TouchableOpacity>

        </View>
        
      </View>

      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
        {/* Przycisk TRYBU LIVE */}
        <TouchableOpacity 
          onPress={toggleLiveEcg}
          disabled={isLiveButtonDisabled}
          style={{
            flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            padding: 16, borderRadius: 16, borderWidth: 1,
            backgroundColor: isLiveEcgActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(39, 39, 42, 0.6)',
            borderColor: isLiveEcgActive ? '#10b981' : '#27272a',
            opacity: isLiveButtonDisabled ? 0.4 : 1
          }}
        >
          <Activity size={18} color={isLiveEcgActive ? "#34d399" : "#a1a1aa"} />
          <Text style={{
            color: isLiveEcgActive ? '#34d399' : '#a1a1aa',
            fontSize: 12, fontWeight: '800', marginLeft: 8, letterSpacing: 0.5
          }}>
            {isLiveEcgActive ? 'ZATRZYMAJ' : 'NA ŻYWO'}
          </Text>
        </TouchableOpacity>

        {/* Przycisk POBIERZ BADANIE */}
        <TouchableOpacity
          onPress={getFileFromDevice}
          disabled={isDownloadButtonDisabled}
          style={{
            flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            padding: 16, borderRadius: 16, borderWidth: 1,
            backgroundColor: bleState === 'connected' ? 'rgba(129, 140, 248, 0.15)' : 'rgba(39, 39, 42, 0.6)',
            borderColor: bleState === 'connected' ? 'rgba(99, 102, 241, 0.4)' : '#27272a',
            opacity: isDownloadButtonDisabled ? 0.4 : 1
          }}
        >
          <FileDown size={18} color={bleState === 'connected' ? "#818cf8" : "#a1a1aa"} />
          <Text style={{
            color: bleState === 'connected' ? '#818cf8' : '#a1a1aa',
            fontSize: 12, fontWeight: '800', marginLeft: 8, letterSpacing: 0.5
          }}>
            POBIERZ BADANIE 
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
        <TouchableOpacity 
          onPress={loadMockReport}
          style={{
            flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            padding: 16, borderRadius: 16, borderWidth: 1,
            backgroundColor: 'rgba(129, 140, 248, 0.12)',
            borderColor: '#818cf8'
          }}
        >
          <Database size={18} color="#818cf8" />
          <Text style={{
            color: '#818cf8',
            fontSize: 12,
            fontWeight: '800',
            marginLeft: 8,
            letterSpacing: 0.5
          }}>
            GENERUJ PRÓBNY RAPORT
          </Text>
        </TouchableOpacity>
      </View>

      <DeviceDiagnostics bleState={bleState} diagnostics={diagnostics} />

      {isLiveEcgActive && (
        <View style={{ marginBottom: 20 }}>
          <Text style={{ color: '#a1a1aa', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginLeft: 8, marginBottom: 4 }}>
            MONITORING EKG NA ŻYWO
          </Text>
          <LiveEcgChart isMeasuring={isLiveEcgActive} />
        </View>
      )}

      {!deviceData ? (
        <View style={{
          alignItems: 'center', padding: 32, backgroundColor: 'rgba(24, 24, 27, 0.4)', 
          borderRadius: 20, borderWidth: 1, borderColor: '#27272a', marginTop: 8, marginBottom: 20
        }}>
          <Database size={32} color="#52525b" style={{ marginBottom: 12 }} />
          <Text style={{ color: '#a1a1aa', fontSize: 14, fontWeight: '700' }}>Brak wczytanego badania</Text>
          <Text style={{ color: '#71717a', fontSize: 12, textAlign: 'center', marginTop: 8, lineHeight: 18 }}>
            Połącz się z urządzeniem i użyj przycisku "POBIERZ BADANIE", aby załadować i przeanalizować dane EKG.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={styles.statIconBg}><Clock size={18} color="#60a5fa" /></View>
              <View>
                <Text style={styles.statValue}>{deviceData.duration}</Text>
                <Text style={styles.statLabel}>Czas zapisu</Text>
              </View>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statIconBg}><AlertCircle size={18} color="#fb7185" /></View>
              <View>
                <Text style={styles.statValue}>
                  {deviceData.arrhythmiaEvents} <Text style={styles.statUnit}>zdarzeń</Text>
                </Text>
                <Text style={styles.statLabel}>Epizody Arytmii</Text>
              </View>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statIconBg}><Heart size={18} color="#34d399" /></View>
              <View>
                <Text style={styles.statValue}>
                  {deviceData.minBpm} <Text style={styles.statUnit}>BPM</Text>
                </Text>
                <Text style={styles.statLabel}>Najniższe Tętno</Text>
              </View>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statIconBg}><Zap size={18} color="#fbbf24" /></View>
              <View>
                <Text style={styles.statValue}>
                  {deviceData.maxBpm} <Text style={styles.statUnit}>BPM</Text>
                </Text>
                <Text style={styles.statLabel}>Najwyższe Tętno</Text>
              </View>
            </View>
          </View>

          <View style={{ marginTop: 16 }}>
            <TrendChart data={deviceData.hourlyTrend} />
          </View>
          <View style={{ marginTop: 16 }}>
            <ActivityChart data={deviceData.hourlyTrend} />
          </View>
        </>
      )}

      <View style={styles.bottomAction}>
        <TouchableOpacity 
          onPress={() => openReport(deviceData)} 
          disabled={!deviceData} 
          style={[styles.btnPrimary, !deviceData && styles.btnPrimaryDisabled]}
        >
          <ShieldCheck size={22} color={deviceData ? "#c7d2fe" : "#52525b"} />
          <Text style={[styles.btnPrimaryText, !deviceData && styles.btnPrimaryTextDisabled]}>Otwórz Raport Kliniczny</Text>
          {deviceData && <ChevronRight size={18} color="#818cf8" style={{ position: 'absolute', right: 20 }} />}
        </TouchableOpacity>
      </View>
      
    </View>
  );
};

export default HomeScreen;
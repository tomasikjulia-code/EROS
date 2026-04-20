import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { 
  HeartPulse, Bluetooth, BluetoothConnected, CheckCircle2, 
  AlertCircle, BatteryMedium, Clock, RefreshCw, Heart, 
  Zap, ShieldCheck, ChevronRight, Activity, FileDown, Database
} from 'lucide-react-native';

import { styles } from '../constants/Theme';
import DeviceDiagnostics from '../components/DeviceDiagnostics';
import TrendChart from '../components/TrendChart';
import LiveEcgChart from '../components/LiveEcgChart'; 

const HomeScreen = ({ 
  bleState, 
  deviceData, 
  syncState, 
  diagnostics, 
  toggleBluetooth, 
  syncData,
  refreshDiagnostics, 
  openReport, 
  formatDate,
  toggleLiveEcg,
  isLiveEcgActive,
  getFileFromDevice, 
  lastConnectedTime
}) => {
  return (
    <View style={styles.screenContent}>

      <View style={styles.topBar}>
        <View style={styles.row}>
          <View style={styles.logoIcon}>
            <HeartPulse color="#fff" size={24} />
          </View>
          <View>
            <Text style={styles.logoText}>EROS</Text>
            <Text style={styles.logoSubtext}>MOBILE SYNC</Text>
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
        <View style={styles.heroHeader}>
          <View>
            {bleState === 'connected' ? (
              <View style={[styles.badge, styles.badgeBlue]}>
                <View style={styles.dotPulse} />
                <Text style={styles.badgeTextBlue}>Monitorowanie Aktywne</Text>
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
               style={syncState === 'syncing' ? { transform: [{ rotate: '45deg' }] } : {}}
             />
          </TouchableOpacity>
        </View>
        
        <View style={styles.heroMain}>
          <Text style={styles.heroBpmText}>{deviceData?.avgBpm || '--'}</Text>
          <View style={{ paddingBottom: 8 }}>
            <Text style={styles.heroBpmLabel}>BPM</Text>
            <Text style={styles.heroBpmSublabel}>Średnio</Text>
          </View>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
        <TouchableOpacity 
          onPress={toggleLiveEcg}
          disabled={bleState !== 'connected'}
          style={{
            flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            padding: 16, borderRadius: 16, borderWidth: 1,
            backgroundColor: isLiveEcgActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(39, 39, 42, 0.6)',
            borderColor: isLiveEcgActive ? '#10b981' : '#27272a',
            opacity: bleState !== 'connected' ? 0.4 : 1
          }}
        >
          <Activity size={18} color={isLiveEcgActive ? "#34d399" : "#a1a1aa"} />
          <Text style={{
            color: isLiveEcgActive ? '#34d399' : '#a1a1aa',
            fontSize: 12, fontWeight: '800', marginLeft: 8, letterSpacing: 0.5
          }}>
            {isLiveEcgActive ? 'ZATRZYMAJ LIVE' : 'NA ŻYWO'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={getFileFromDevice} // <--- ZMIANA 2: Podpięto nową funkcję
          disabled={bleState !== 'connected'}
          style={{
            flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            padding: 16, borderRadius: 16, borderWidth: 1,
            backgroundColor: bleState === 'connected' ? 'rgba(129, 140, 248, 0.15)' : 'rgba(39, 39, 42, 0.6)',
            borderColor: bleState === 'connected' ? 'rgba(99, 102, 241, 0.4)' : '#27272a',
            opacity: bleState !== 'connected' ? 0.4 : 1
          }}
        >
          <FileDown size={18} color={bleState === 'connected' ? "#818cf8" : "#a1a1aa"} />
          <Text style={{
            color: bleState === 'connected' ? '#818cf8' : '#a1a1aa',
            fontSize: 12, fontWeight: '800', marginLeft: 8, letterSpacing: 0.5
          }}>
            POBIERZ BADANIE {/* <--- ZMIANA 3: Bardziej logiczny tekst na przycisku */}
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
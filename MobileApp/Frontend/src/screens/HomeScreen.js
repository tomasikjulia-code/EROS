import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { 
  HeartPulse, Bluetooth, BluetoothConnected, CheckCircle2, 
  AlertCircle, BatteryMedium, Clock, RefreshCw, Heart, 
  Zap, ShieldCheck, ChevronRight 
} from 'lucide-react-native';

import { styles } from '../constants/Theme';
import DeviceDiagnostics from '../components/DeviceDiagnostics';
import TrendChart from '../components/TrendChart';

const HomeScreen = ({ 
  bleState, 
  deviceData, 
  syncState, 
  diagnostics, 
  toggleBluetooth, 
  syncData, 
  openReport, 
  formatDate 
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
                <Text style={styles.badgeTextBlue}>Połączono z Holterem</Text>
              </View>
            ) : deviceData ? (
              <View style={[styles.badge, styles.badgeEmerald]}>
                <CheckCircle2 size={12} color="#34d399" />
                <Text style={styles.badgeTextEmerald}>Tryb Offline (Ostatni)</Text>
              </View>
            ) : (
              <View style={[styles.badge, styles.badgeZinc]}>
                <AlertCircle size={12} color="#a1a1aa" />
                <Text style={styles.badgeTextZinc}>Brak danych</Text>
              </View>
            )}
            
            <View style={[styles.row, { marginTop: 8 }]}>
              {bleState === 'connected' ? (
                <>
                  <BatteryMedium size={14} color="#34d399"/>
                  <Text style={styles.subText}>EROS PRO v2.1</Text>
                </>
              ) : deviceData ? (
                <>
                  <Clock size={12} color="#a1a1aa"/>
                  <Text style={styles.subText}>{formatDate(deviceData.date)}</Text>
                </>
              ) : (
                <Text style={styles.subText}>Urządzenie niepołączone</Text>
              )}
            </View>
          </View>
          
          <TouchableOpacity 
            onPress={syncData} 
            disabled={syncState === 'syncing' || bleState === 'disconnected'} 
            style={[styles.btnSync, (syncState === 'syncing' || bleState === 'disconnected') && styles.btnSyncDisabled]}
          >
             <RefreshCw size={20} color={bleState === 'disconnected' ? '#52525b' : '#fff'} />
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

      <DeviceDiagnostics bleState={bleState} diagnostics={diagnostics} />

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <View style={styles.statIconBg}><Clock size={18} color="#60a5fa" /></View>
          <View>
            <Text style={styles.statValue}>{deviceData?.duration.substring(0,5) || '--'}</Text>
            <Text style={styles.statLabel}>Czas zapisu</Text>
          </View>
        </View>
        <View style={styles.statCard}>
          <View style={styles.statIconBg}><AlertCircle size={18} color="#fb7185" /></View>
          <View>
            <Text style={styles.statValue}>
              {deviceData?.arrhythmiaEvents ?? '--'} <Text style={styles.statUnit}>{deviceData ? 'zdarzeń' : ''}</Text>
            </Text>
            <Text style={styles.statLabel}>Epizody Arytmii</Text>
          </View>
        </View>
        <View style={styles.statCard}>
          <View style={styles.statIconBg}><Heart size={18} color="#34d399" /></View>
          <View>
            <Text style={styles.statValue}>
              {deviceData?.minBpm || '--'} <Text style={styles.statUnit}>{deviceData ? 'BPM' : ''}</Text>
            </Text>
            <Text style={styles.statLabel}>Najniższe Tętno</Text>
          </View>
        </View>
        <View style={styles.statCard}>
          <View style={styles.statIconBg}><Zap size={18} color="#fbbf24" /></View>
          <View>
            <Text style={styles.statValue}>
              {deviceData?.maxBpm || '--'} <Text style={styles.statUnit}>{deviceData ? 'BPM' : ''}</Text>
            </Text>
            <Text style={styles.statLabel}>Najwyższe Tętno</Text>
          </View>
        </View>
      </View>

      <View style={{ marginTop: 16 }}>
        <TrendChart data={deviceData?.hourlyTrend} />
      </View>

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
import React from 'react';
import { View, Text } from 'react-native';
import { BatteryMedium, Waves, Activity } from 'lucide-react-native';
import { styles } from '../constants/Theme'; 

const DeviceDiagnostics = ({ bleState, diagnostics }) => {
  if (bleState !== 'connected') return null;
  if (!diagnostics) return (
    <View style={styles.diagContainer}>
      <Text style={styles.diagLabel}>Oczekiwanie na dane urządzenia...</Text>
    </View>
  );

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

export default DeviceDiagnostics;
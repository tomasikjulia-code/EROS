import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Accessibility, Bell, Smartphone } from 'lucide-react-native';
import { styles } from '../constants/Theme';

const SettingsScreen = ({ 
  isVoiceEnabled, 
  handleVoiceToggle, 
  isNotifEnabled, 
  setIsNotifEnabled, 
  isVibrateEnabled, 
  setIsVibrateEnabled 
}) => {
  return (
    <View style={styles.screenContent}>
      
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Ustawienia</Text>
        <Text style={styles.pageSubtitle}>Dostosuj aplikację do swoich potrzeb.</Text>
      </View>
      
      <Text style={styles.sectionTitle}>DOSTĘPNOŚĆ (ACCESSIBILITY)</Text>
      <View style={styles.settingCard}>
        <View style={styles.settingRow}>
          <View style={styles.row}>
            <View style={[styles.settingIconBg, isVoiceEnabled && styles.settingIconBgActive]}>
              <Accessibility size={22} color={isVoiceEnabled ? "#818cf8" : "#a1a1aa"} />
            </View>
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.settingTitle}>Asystent Głosowy</Text>
              <Text style={styles.settingSub}>Odczytuje powiadomienia na głos.</Text>
            </View>
          </View>
          <TouchableOpacity 
            onPress={handleVoiceToggle} 
            style={[styles.toggleTrack, isVoiceEnabled && styles.toggleTrackActive]}
          >
            <View style={[styles.toggleThumb, isVoiceEnabled && styles.toggleThumbActive]} />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>POWIADOMIENIA I SYSTEM</Text>
      <View style={styles.settingCard}>
        
        {/* Przełącznik Powiadomień */}
        <View style={[styles.settingRow, styles.settingBorderBottom]}>
          <View style={styles.row}>
            <View style={[styles.settingIconBg, isNotifEnabled && { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
              <Bell size={22} color={isNotifEnabled ? "#60a5fa" : "#a1a1aa"} />
            </View>
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.settingTitle}>Powiadomienia Push</Text>
              <Text style={styles.settingSub}>Alert o nowym raporcie.</Text>
            </View>
          </View>
          <TouchableOpacity 
            onPress={() => setIsNotifEnabled(!isNotifEnabled)} 
            style={[styles.toggleTrack, isNotifEnabled && { backgroundColor: '#2563eb', borderColor: '#3b82f6' }]}
          >
            <View style={[styles.toggleThumb, isNotifEnabled && styles.toggleThumbActive]} />
          </TouchableOpacity>
        </View>

        <View style={styles.settingRow}>
          <View style={styles.row}>
            <View style={[styles.settingIconBg, isVibrateEnabled && { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
              <Smartphone size={22} color={isVibrateEnabled ? "#34d399" : "#a1a1aa"} />
            </View>
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.settingTitle}>Wibracje</Text>
              <Text style={styles.settingSub}>Haptyka przy akcjach systemu.</Text>
            </View>
          </View>
          <TouchableOpacity 
            onPress={() => setIsVibrateEnabled(!isVibrateEnabled)} 
            style={[styles.toggleTrack, isVibrateEnabled && { backgroundColor: '#059669', borderColor: '#10b981' }]}
          >
            <View style={[styles.toggleThumb, isVibrateEnabled && styles.toggleThumbActive]} />
          </TouchableOpacity>
        </View>
        
      </View>
      
    </View>
  );
};

export default SettingsScreen;
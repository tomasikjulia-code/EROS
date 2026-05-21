import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Volume2, Bell } from 'lucide-react-native';
import { styles } from '../constants/Theme';

const SettingsScreen = ({ 
  isVoiceEnabled, 
  handleVoiceToggle, 
  isNotifEnabled, 
  setIsNotifEnabled 
}) => {
  return (
    <View style={styles.screenContent}>
      
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Ustawienia</Text>
        <Text style={styles.pageSubtitle}>Dostosuj aplikację do swoich potrzeb.</Text>
      </View>
      
      <Text style={styles.sectionTitle}>DOSTĘPNOŚĆ</Text>
      <View style={styles.settingCard}>
        <View style={styles.settingRow}>
          <View style={styles.row}>
            <View style={[styles.settingIconBg, isVoiceEnabled && styles.settingIconBgActive]}>
              <Volume2 size={22} color={isVoiceEnabled ? "#818cf8" : "#a1a1aa"} />
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
        <View style={styles.settingRow}>
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
        
      </View>
      
    </View>
  );
};

export default SettingsScreen;
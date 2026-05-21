import React from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { 
  Calendar, Clock, Heart, AlertCircle, ChevronRight, Activity, Trash2 
} from 'lucide-react-native';

import { styles } from '../constants/Theme';

const HistoryScreen = ({ records, openReport, formatDate, deleteRecord }) => {
  
  // Wyświetlamy systemowe okienko z potwierdzeniem usunięcia
  const confirmDelete = (id) => {
    Alert.alert(
      "Usuwanie badania",
      "Czy na pewno chcesz trwale usunąć ten raport z archiwum?",
      [
        { text: "Anuluj", style: "cancel" },
        { 
          text: "Usuń", 
          style: "destructive", 
          onPress: () => deleteRecord(id) 
        }
      ]
    );
  };

  return (
    <View style={styles.screenContent}>
      
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Archiwum</Text>
        <Text style={styles.pageSubtitle}>Zapisane raporty z badań EKG.</Text>
      </View>

      {!records || records.length === 0 ? (
        <View style={localStyles.emptyContainer}>
          <View style={localStyles.emptyIconWrapper}>
            <Calendar color="#71717a" size={32} />
          </View>
          <Text style={styles.emptyTextTitle}>Brak pomiarów</Text>
          <Text style={{ color: '#71717a', fontSize: 13, marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
            Połącz urządzenie i pobierz badanie,{'\n'}aby pojawiło się w archiwum.
          </Text>
        </View>
      ) : (
        records.map((record) => {
          const hasAlerts = 
            (record.tachyEpisodes > 0) || 
            (record.bradyEpisodes > 0) || 
            (record.importantDetails && record.importantDetails.length > 0);

          return (
            <TouchableOpacity 
              key={record.id} 
              onPress={() => openReport(record)} 
              style={[localStyles.card, hasAlerts && localStyles.cardAlert]} 
              activeOpacity={0.7}
            >
              {/* GÓRNY RZĄD: Ikona, Data, Usuwanie, Strzałka */}
              <View style={localStyles.cardHeader}>
                <View style={localStyles.headerLeft}>
                  <View style={[localStyles.iconWrapper, hasAlerts && localStyles.iconWrapperAlert]}>
                    <Activity size={20} color={hasAlerts ? "#fb7185" : "#818cf8"} />
                  </View>
                  <Text style={localStyles.dateText}>{formatDate(record.date)}</Text>
                </View>

                <View style={localStyles.headerRight}>
                  <TouchableOpacity 
                    onPress={() => confirmDelete(record.id)} 
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Trash2 size={18} color="#71717a" />
                  </TouchableOpacity>
                  <ChevronRight size={20} color="#52525b" />
                </View>
              </View>

              {/* DOLNY RZĄD: Wskaźniki i Odznaki */}
              <View style={localStyles.statsRow}>
                <View style={localStyles.badge}>
                  <Clock size={14} color="#60a5fa" />
                  <Text style={localStyles.badgeText}>{record.duration}</Text>
                </View>
                
                <View style={localStyles.badge}>
                  <Heart size={14} color="#fb7185" />
                  <Text style={localStyles.badgeText}>Śr: {record.avgBpm} BPM</Text>
                </View>
                
                {hasAlerts && (
                  <View style={[localStyles.badge, localStyles.badgeAlert]}>
                    <AlertCircle size={14} color="#fb7185" />
                    <Text style={localStyles.badgeTextAlert}>Wykryto zdarzenia</Text>
                  </View>
                )}
              </View>

            </TouchableOpacity>
          );
        })
      )}
      
    </View>
  );
};

// Lokalne style, by nie ruszać głównego pliku Theme.js i upewnić się, że wszystko wygląda idealnie
const localStyles = StyleSheet.create({
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
    marginTop: 20,
    backgroundColor: '#09090b',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#27272a',
    borderStyle: 'dashed',
  },
  emptyIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#18181b',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#09090b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  cardAlert: {
    borderColor: 'rgba(251, 113, 133, 0.25)',
    backgroundColor: 'rgba(251, 113, 133, 0.03)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#1e1b4b', 
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapperAlert: {
    backgroundColor: 'rgba(251, 113, 133, 0.1)',
  },
  dateText: {
    color: '#f4f4f5',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 12,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#27272a',
    gap: 6,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#a1a1aa',
  },
  badgeAlert: {
    backgroundColor: 'rgba(251, 113, 133, 0.1)',
    borderColor: 'rgba(251, 113, 133, 0.2)',
  },
  badgeTextAlert: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fb7185',
  }
});

export default HistoryScreen;
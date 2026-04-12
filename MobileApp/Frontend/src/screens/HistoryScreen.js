import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { 
  Calendar, FileText, Clock, Heart, AlertCircle, ChevronRight 
} from 'lucide-react-native';

import { styles } from '../constants/Theme';

const HistoryScreen = ({ records, openReport, formatDate }) => {
  return (
    <View style={styles.screenContent}>
      
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Archiwum</Text>
        <Text style={styles.pageSubtitle}>Zapisane pełne wyniki pomiarów EROS.</Text>
      </View>

      {records.length === 0 ? (
        <View style={[styles.chartContainer, styles.centerAll, { marginTop: 20, paddingVertical: 40 }]}>
          <Calendar color="#52525b" size={40} style={{ marginBottom: 16 }} />
          <Text style={styles.emptyTextTitle}>Brak zapisanych pomiarów</Text>
        </View>
      ) : (
        records.map((record) => (
          <TouchableOpacity 
            key={record.id} 
            onPress={() => openReport(record)} 
            style={styles.historyCard} 
            activeOpacity={0.7}
          >
            <View style={styles.row}>
              <View style={styles.historyIconBg}>
                <FileText size={22} color="#818cf8" />
              </View>
              
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.historyDate}>{formatDate(record.date)}</Text>
                
                <View style={[styles.row, { marginTop: 6, gap: 12 }]}>
                  <View style={styles.historyBadge}>
                    <Clock size={12} color="#60a5fa" />
                    <Text style={styles.historyBadgeText}>{record.duration.substring(0,5)}h</Text>
                  </View>
                  <View style={styles.historyBadge}>
                    <Heart size={12} color="#fb7185" />
                    <Text style={styles.historyBadgeText}>{record.avgBpm} BPM</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.row}>
              {(record.veb.total > 100 || record.pauses.count > 0) && (
                <View style={styles.historyAlertBadge}>
                  <AlertCircle size={16} color="#fb7185" />
                </View>
              )}
              <ChevronRight size={20} color="#52525b" />
            </View>
          </TouchableOpacity>
        ))
      )}
      
    </View>
  );
};

export default HistoryScreen;
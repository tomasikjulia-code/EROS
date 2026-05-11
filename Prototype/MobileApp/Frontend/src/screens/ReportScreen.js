import React from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { 
  ChevronLeft, FileText, Calendar, Clock, Table2, 
  Activity, CheckCircle2, AlertCircle, Download, Mail, Send 
} from 'lucide-react-native';

import { styles } from '../constants/Theme';
import TrendChart from '../components/TrendChart';
import ActivityChart from '../components/ActivityChart'; 
import EcgStrip from '../components/EcgStrip';

const ReportScreen = ({ 
  activeReportRecord, 
  setView, 
  formatDate, 
  aiReport, 
  doctorEmail, 
  setDoctorEmail, 
  showToast 
}) => {
  
  if (!activeReportRecord) return null; 

  const formatTime = (ms) => {
      if (ms === undefined || ms === null || isNaN(ms)) return "0:00"; // zabezpieczenie przed NaN
      const totalSeconds = Math.floor(ms / 1000);
      const mins = Math.floor(totalSeconds / 60);
      const secs = totalSeconds % 60;
      return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

  return (
    <View style={styles.screenContent}>
      
      <View style={styles.reportNavRow}>
        <TouchableOpacity onPress={() => setView('home')} style={styles.btnBack}>
          <ChevronLeft size={20} color="#a1a1aa" />
          <Text style={styles.btnBackText}>Wróć</Text>
        </TouchableOpacity>
        <View style={styles.patientBadge}>
          <Text style={styles.patientBadgeText}>KARTA PACJENTA</Text>
        </View>
      </View>

      <View style={styles.reportCard}>
        <View style={styles.reportHeader}>
          <View style={styles.row}>
            <FileText size={24} color="#6366f1" />
            <Text style={styles.reportTitle}>Raport Kliniczny</Text>
          </View>
          <View style={[styles.row, { marginTop: 12, gap: 16 }]}>
            <View style={styles.row}>
              <Calendar size={14} color="#71717a"/>
              <Text style={styles.reportSub}> {formatDate(activeReportRecord.date)}</Text>
            </View>
            <View style={styles.row}>
              <Clock size={14} color="#71717a"/>
              <Text style={styles.reportSub}> {activeReportRecord.duration}</Text>
            </View>
          </View>
        </View>

        {/* TABELA - ZESTAWIENIE */}
        <View style={styles.tableCard}>
          <View style={styles.tableHeader}>
            <Table2 size={16} color="#818cf8" />
            <Text style={styles.tableHeaderText}>ZESTAWIENIE ZDARZEŃ</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Całkowita liczba QRS</Text>
            <Text style={styles.tableCellValue}>
              {activeReportRecord.totalBeats ? activeReportRecord.totalBeats.toLocaleString() : '0'}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Tachykardia (epizody)</Text>
            <Text style={styles.tableCellValue}>{activeReportRecord.tachyEpisodes || 0}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Bradykardia (epizody)</Text>
            <Text style={styles.tableCellValue}>{activeReportRecord.bradyEpisodes || 0}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Średnie Tętno (BPM)</Text>
            <Text style={styles.tableCellValue}>{activeReportRecord.avgBpm || 0}</Text>
          </View>
          <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.tableCellLabel}>Pauzy RR {'>'} 2.0s</Text>
            <Text style={styles.tableCellValue}>
              {activeReportRecord.pauses ? activeReportRecord.pauses.count : 0}
            </Text>
          </View>
        </View>

        {/* WYKRES TRENDU (BPM) */}
        <View style={{ marginTop: 16 }}>
          <TrendChart data={activeReportRecord.hourlyTrend || []} />
        </View>

        {/* WYKRES AKTYWNOŚCI */}
        <View style={{ marginTop: 16 }}>
          <ActivityChart data={activeReportRecord.hourlyTrend || []} />
        </View>

        {/* NIEPRAWIDLOWOSCI */}
        <View style={[styles.tableCard, { marginTop: 24 }]}>
          <View style={styles.tableHeader}>
            <Activity size={16} color="#fb7185" />
            <Text style={styles.tableHeaderText}>WYKRYTE EPIZODY</Text>
          </View>
          
          {/* Renderowanie Tachykardii */}
          {(activeReportRecord.tachyDetails || []).map((det, idx) => (
            <View key={`tachy-${idx}`} style={styles.tableRow}>
              <View>
                <Text style={styles.tableCellLabel}>Epizod Tachykardii #{idx + 1}</Text>
                <Text style={{ fontSize: 10, color: '#71717a' }}>Tachykardia zatokowa</Text>
              </View>
              <Text style={styles.tableCellValue}>
                {formatTime(det.start)} — {formatTime(det.end)}
              </Text>
            </View>
          ))}

          {/* Renderowanie Bradykardii */}
          {(activeReportRecord.bradyDetails || []).map((det, idx) => (
            <View key={`brady-${idx}`} style={styles.tableRow}>
              <View>
                <Text style={styles.tableCellLabel}>Epizod Bradykardii #{idx + 1}</Text>
                <Text style={{ fontSize: 10, color: '#71717a' }}>Istotne zwolnienie rytmu</Text>
              </View>
              <Text style={styles.tableCellValue}>
                {formatTime(det.start)} — {formatTime(det.end)}
              </Text>
            </View>
          ))}

          {/* Jeśli nie było ŻADNYCH epizodów */}
          {(!activeReportRecord.tachyDetails || activeReportRecord.tachyDetails.length === 0) && 
           (!activeReportRecord.bradyDetails || activeReportRecord.bradyDetails.length === 0) && (
            <View style={styles.tableRow}>
              <Text style={[styles.tableCellLabel, { color: '#71717a', fontStyle: 'italic' }]}>
                Nie wykryto istotnych epizodów arytmii.
              </Text>
            </View>
          )}
        </View>

        <View style={{ marginTop: 32 }}>
          <View style={styles.row}>
            <View style={styles.iconBgEmerald}>
              <Activity size={18} color="#34d399"/>
            </View>
            <Text style={styles.sectionTitleAi}>Analiza Badania</Text>
          </View>

          {aiReport ? (
            <>
              <View style={styles.aiBox}>
                <Text style={styles.aiText}>{aiReport.summary}</Text>
              </View>
              <View style={styles.aiBox}>
                <Text style={styles.aiBoxTitle}>Szczegółowe Wnioski:</Text>
                {(aiReport.findings || []).map((finding, idx) => (
                  <View key={idx} style={styles.aiListItem}>
                    <CheckCircle2 size={16} color="#34d399" />
                    <Text style={styles.aiListText}>{finding}</Text>
                  </View>
                ))}
              </View>
              
              <View style={{ marginTop: 24 }}>
                <View style={[styles.row, { marginBottom: 16 }]}>
                  <Activity size={20} color="#fb7185" />
                  <Text style={[styles.sectionTitleAi, { marginLeft: 8 }]}>Wycinki EKG</Text>
                </View>
                {(aiReport.snippets || []).map((snippet, idx) => (
                  <EcgStrip 
                    key={idx} 
                    title={snippet.title} 
                    description={snippet.description} 
                    time={snippet.time} 
                    hr={snippet.hr} 
                    data={snippet.data} 
                  />
                ))}
              </View>

              <View style={styles.warningBox}>
                <View style={styles.row}>
                  <AlertCircle size={16} color="#fb7185" />
                  <Text style={styles.warningTitle}>Ważna uwaga medyczna:</Text>
                </View>
                <Text style={styles.warningText}>{aiReport.recommendation}</Text>
              </View>
            </>
          ) : (
            <View style={styles.aiBox}>
              <Text style={styles.aiText}>Trwa analiza...</Text>
            </View>
          )}
        </View>
      </View>

      {aiReport && (
        <View style={{ marginTop: 24, paddingHorizontal: 4 }}>
          <TouchableOpacity 
            onPress={() => showToast("Zapisywanie pliku PDF...", "info")} 
            style={styles.btnSecondary}
          >
            <Download size={20} color="#fff" />
            <Text style={styles.btnSecondaryText}>Zapisz dokument PDF</Text>
          </TouchableOpacity>
          <View style={styles.emailForm}>
            <Mail size={20} color="#71717a" style={{ marginLeft: 16 }} />
            <TextInput 
              style={styles.input} 
              placeholder="E-mail lekarza kardiologa" 
              placeholderTextColor="#71717a" 
              value={doctorEmail} 
              onChangeText={setDoctorEmail} 
              keyboardType="email-address" 
            />
            <TouchableOpacity 
              onPress={() => { 
                setDoctorEmail(''); 
                showToast("Zaszyfrowany raport wysłany!"); 
              }} 
              style={styles.btnSend}
            >
              <Send size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

export default ReportScreen;
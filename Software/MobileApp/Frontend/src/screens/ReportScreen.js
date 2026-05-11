import React from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { 
  ChevronLeft, FileText, Calendar, Clock, Table2, 
  Activity, CheckCircle2, AlertCircle, Download, Mail, Send 
} from 'lucide-react-native';

import { styles } from '../constants/Theme';
import TrendChart from '../components/TrendChart';
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
            <Text style={styles.reportTitle}>Kliniczny Raport Holter</Text>
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

        <View style={styles.tableCard}>
          <View style={styles.tableHeader}>
            <Table2 size={16} color="#818cf8" />
            <Text style={styles.tableHeaderText}>ZESTAWIENIE ZDARZEŃ</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Całkowita liczba QRS</Text>
            <Text style={styles.tableCellValue}>{activeReportRecord.totalBeats.toLocaleString()}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Arytmie Nadkomorowe</Text>
            <Text style={styles.tableCellValue}>{activeReportRecord.sveb.total}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Arytmie Komorowe</Text>
            <Text style={styles.tableCellValue}>{activeReportRecord.veb.total}</Text>
          </View>
          <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.tableCellLabel}>Pauzy RR {'>'} 2.0s</Text>
            <Text style={styles.tableCellValue}>{activeReportRecord.pauses.count}</Text>
          </View>
        </View>

        <TrendChart data={activeReportRecord.hourlyTrend} />

        <View style={{ marginTop: 32 }}>
          <View style={styles.row}>
            <View style={styles.iconBgEmerald}>
              <Activity size={18} color="#34d399"/>
            </View>
            <Text style={styles.sectionTitleAi}>Interpretacja Algorytmu AI</Text>
          </View>

          {aiReport && (
            <>
              <View style={styles.aiBox}>
                <Text style={styles.aiText}>{aiReport.summary}</Text>
              </View>
              <View style={styles.aiBox}>
                <Text style={styles.aiBoxTitle}>Szczegółowe Wnioski:</Text>
                {aiReport.findings.map((finding, idx) => (
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
                {aiReport.snippets.map((snippet, idx) => (
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
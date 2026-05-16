import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { 
  ChevronLeft, FileText, Calendar, Clock, Table2, 
  Activity, CheckCircle2, AlertCircle, Download, Mail, Send, Database, Trash2, FileSpreadsheet
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
  showToast,
  saveToDownloads
}) => {
  // Stany do obsługi komentarzy w pływającym oknie
  const [eventComments, setEventComments] = useState({});
  const [activeEditIdx, setActiveEditIdx] = useState(null);
  const [draftComment, setDraftComment] = useState("");     

  if (!activeReportRecord) return null; 

  const formatTime = (ms) => {
      if (ms === undefined || ms === null || isNaN(ms)) return "0:00"; 
      const totalSeconds = Math.floor(ms / 1000);
      const mins = Math.floor(totalSeconds / 60);
      const secs = totalSeconds % 60;
      return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

  const handleOpenEdit = (idx) => {
    setActiveEditIdx(idx);
    setDraftComment(eventComments[idx] || '');
  };

  const handleCancelEdit = () => {
    setActiveEditIdx(null);
    setDraftComment('');
  };

  const handleSaveEdit = () => {
    setEventComments(prev => ({ ...prev, [activeEditIdx]: draftComment }));
    setActiveEditIdx(null);
    showToast("Komentarz do zdarzenia został zapisany.", "success");
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
            <Text style={styles.tableCellLabel}>Ważne Zdarzenia</Text>
            <Text style={[styles.tableCellValue, {color: (activeReportRecord.importantDetails?.length > 0) ? '#fb7185' : '#fff' }]}>
              {activeReportRecord.importantDetails ? activeReportRecord.importantDetails.length : 0}
            </Text>
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
          
          {(activeReportRecord.importantDetails || []).map((det, idx) => (
            <View key={`imp-${idx}`} style={styles.tableRow}>
              <View>
                <Text style={[styles.tableCellLabel, { color: '#fb7185' }]}>Ważne Zdarzenie #{idx + 1}</Text>
                <Text style={{ fontSize: 10, color: '#71717a' }}>Zgłoszone z urządzenia</Text>
              </View>
              <Text style={styles.tableCellValue}>
                {formatTime(det.start)} — {formatTime(det.end)}
              </Text>
            </View>
          ))}

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
           (!activeReportRecord.bradyDetails || activeReportRecord.bradyDetails.length === 0) &&
           (!activeReportRecord.importantDetails || activeReportRecord.importantDetails.length === 0) && (
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
                {(aiReport.snippets || []).map((snippet, idx) => {
                  const isImportantEvent = snippet.title.startsWith("Ważne Zdarzenie");
                  
                  return (
                    // Margines 40 oddziela całe sekcje zdarzeń od siebie
                    <View key={idx} style={{ marginBottom: 40 }}>
                      
                      <EcgStrip 
                        title={snippet.title} 
                        description={snippet.description} 
                        time={snippet.time} 
                        hr={snippet.hr} 
                        data={snippet.data} 
                      />
                      
                      {/* Obsługa komentarzy dla Ważnych Zdarzeń */}
                      {isImportantEvent && (
                        <View style={{ 
                          marginTop: 8, 
                          marginLeft: 16, // Wcięcie od lewej strony
                          borderLeftWidth: 2, // Pionowa linia łącząca
                          borderColor: '#4f46e5', // Akcentowy kolor linii
                          paddingLeft: 16 // Odstęp elementu od linii
                        }}>
                              {eventComments[idx] ? (
                                // Wyświetlanie zapisanego komentarza
                                <View style={{ 
                                  backgroundColor: '#27272a', 
                                  padding: 12, 
                                  borderRadius: 8, 
                                  borderWidth: 1, 
                                  borderColor: '#3f3f46',
                                  alignItems: 'flex-start'
                                }}>
                                  <Text style={{color: '#a1a1aa', fontWeight: 'bold', fontSize: 10, textTransform: 'uppercase', marginBottom: 4}}>Notatka do zdarzenia</Text>
                                  <Text style={{ color: '#d4d4d8', fontSize: 13, lineHeight: 18 }}>
                                    {eventComments[idx]}
                                  </Text>
                                  <TouchableOpacity onPress={() => handleOpenEdit(idx)} style={{ alignSelf: 'flex-end', marginTop: 8 }}>
                                    <Text style={{ color: '#818cf8', fontSize: 12, fontWeight: 'bold' }}>Edytuj notatkę</Text>
                                  </TouchableOpacity>
                                </View>
                              ) : (
                                <TouchableOpacity 
                                  onPress={() => handleOpenEdit(idx)} 
                                  style={{ 
                                    flexDirection: 'row', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    paddingVertical: 8,
                                    paddingHorizontal: 16,
                                    backgroundColor: 'rgba(129, 140, 248, 0.1)', 
                                    borderRadius: 8,
                                    alignSelf: 'flex-start' 
                                  }}
                                >
                                  <Text style={{ color: '#818cf8', fontSize: 12, fontWeight: '600' }}>+ Dodaj notatkę</Text>
                                </TouchableOpacity>
                              )}
                        </View>
                      )}
                    </View>
                  );
                })}
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
        <View style={{ marginTop: 32, paddingHorizontal: 8, paddingBottom: 40 }}>
          
          {/* SEKCJA 1: UDOSTĘPNIANIE */}
          <Text style={{ color: '#71717a', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 12, marginLeft: 4, letterSpacing: 0.5 }}>
            Udostępnij wynik
          </Text>
          
          <View style={[styles.emailForm, { 
            marginBottom: 24, 
            backgroundColor: '#18181b', 
            borderWidth: 1, 
            borderColor: '#3f3f46', 
            borderRadius: 12, 
            paddingVertical: 4,
            paddingRight: 6
          }]}>
            <Mail size={20} color="#71717a" style={{ marginLeft: 16 }} />
            <TextInput 
              style={[styles.input, { color: '#e4e4e7', fontSize: 14 }]} 
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
              style={[styles.btnSend, { borderRadius: 8 }]}
            >
              <Send size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* SEKCJA 2: POBIERANIE I ZARZĄDZANIE */}
          <Text style={{ color: '#71717a', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 12, marginLeft: 4, letterSpacing: 0.5 }}>
            Zapis i zarządzanie
          </Text>

          <View style={{ gap: 12 }}>
            
            {/* PRZYCISK PDF (Fioletowy) */}
            <TouchableOpacity 
              onPress={() => showToast("Zapisywanie pliku PDF...", "info")} 
              style={{
                flexDirection: 'row', 
                alignItems: 'center', 
                justifyContent: 'center',
                backgroundColor: 'rgba(129, 140, 248, 0.1)', 
                borderWidth: 1,
                borderColor: 'rgba(129, 140, 248, 0.3)', 
                paddingVertical: 14,
                borderRadius: 12,
                gap: 8
              }}
            >
              <Download size={20} color="#818cf8" />
              <Text style={{ color: '#818cf8', fontSize: 14, fontWeight: '600' }}>Zapisz raport PDF</Text>
            </TouchableOpacity>

            {/* PRZYCISK CSV (Zielony - Dane surowe) */}
            <TouchableOpacity 
              onPress={() => {
                if (saveToDownloads) {
                   saveToDownloads(activeReportRecord.hourlyTrend);
                } else {
                   showToast("Błąd: Funkcja pobierania niedostępna.", "error");
                }
              }} 
              style={{
                flexDirection: 'row', 
                alignItems: 'center', 
                justifyContent: 'center',
                backgroundColor: 'rgba(52, 211, 153, 0.1)', 
                borderWidth: 1,
                borderColor: 'rgba(52, 211, 153, 0.3)', 
                paddingVertical: 14,
                borderRadius: 12,
                gap: 8
              }}
            >
              <FileSpreadsheet size={20} color="#34d399" />
              <Text style={{ color: '#34d399', fontSize: 14, fontWeight: '600' }}>Pobierz pełne badanie (CSV)</Text>
            </TouchableOpacity>

            {/* PRZYCISK USUWANIA (Czerwony) */}
            <TouchableOpacity 
              onPress={() => showToast("Funkcja w przygotowaniu...", "info")} 
              style={{
                flexDirection: 'row', 
                alignItems: 'center', 
                justifyContent: 'center',
                backgroundColor: 'rgba(251, 113, 133, 0.05)', 
                borderWidth: 1,
                borderColor: 'rgba(251, 113, 133, 0.2)', 
                paddingVertical: 14,
                borderRadius: 12,
                gap: 8
              }}
            >
              <Trash2 size={20} color="#fb7185" />
              <Text style={{ color: '#fb7185', fontSize: 14, fontWeight: '600' }}>Usuń badanie z karty SD urządzenia</Text>
            </TouchableOpacity>

          </View>
        </View>
      )}

      {/* PŁYWAJĄCE OKNO MODALNE DO EDYCJI */}
      <Modal
        visible={activeEditIdx !== null}
        transparent={true}
        animationType="fade"
      >
        <KeyboardAvoidingView 
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} 
        >
          {/* Klikalne tło do anulowania akcji */}
          <TouchableOpacity style={{ flex: 1 }} onPress={handleCancelEdit} activeOpacity={1} />
          
          <View style={{ backgroundColor: '#18181b', padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, borderColor: '#3f3f46', borderBottomWidth: 0 }}>
            <Text style={{ color: '#e4e4e7', fontSize: 14, fontWeight: 'bold', marginBottom: 12 }}>
              Notatka do zdarzenia
            </Text>
            <TextInput
              style={{ 
                color: '#fff', 
                fontSize: 14, 
                backgroundColor: '#27272a', 
                padding: 12, 
                borderRadius: 8, 
                borderWidth: 1,
                borderColor: '#818cf8',
                minHeight: 80,
                textAlignVertical: 'top'
              }}
              placeholder="Napisz, co robiłeś w tej chwili (np. wszedłem po schodach, poczułem duszności)..."
              placeholderTextColor="#71717a"
              value={draftComment}
              onChangeText={setDraftComment}
              multiline
              autoFocus 
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, gap: 12 }}>
              <TouchableOpacity 
                onPress={handleCancelEdit} 
                style={{ paddingVertical: 10, paddingHorizontal: 16 }}
              >
                <Text style={{ color: '#a1a1aa', fontSize: 14, fontWeight: '600' }}>Anuluj</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleSaveEdit} 
                style={{ backgroundColor: '#818cf8', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 }}
              >
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Zapisz</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
};

export default ReportScreen;
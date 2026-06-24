import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Modal, KeyboardAvoidingView, ScrollView, Platform, Alert, Keyboard } from 'react-native';
import {
  ChevronLeft, FileText, Calendar, Clock, Table2,
  Activity, CheckCircle2, AlertCircle, Download, Mail,
  Send, Sparkles, Database, Trash2, FileSpreadsheet,
  X, ChevronDown, ChevronUp, Bot, Zap,
} from 'lucide-react-native';
import { styles } from '../constants/Theme';
import TrendChart from '../components/TrendChart';
import ActivityChart from '../components/ActivityChart';
import EcgStrip from '../components/EcgStrip';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTs(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}  ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return iso; }
}

// ─── Modal listy analiz AI ────────────────────────────────────────────────────

function AiAnalysesModal({ visible, onClose, llmReports = [], onDelete, onGenerate, generatingStatus }) {
  const [expandedId, setExpandedId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const handleDelete = (entry) => {
    onDelete(entry._meta?.id);
    setConfirmDeleteId(null);
    setExpandedId(null);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#09090b' }}>
        {/* Nagłówek */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 16, paddingVertical: 14,
          borderBottomWidth: 1, borderColor: '#27272a',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Bot size={20} color="#818cf8" />
            <Text style={{ color: '#f4f4f5', fontSize: 17, fontWeight: '700' }}>Analizy AI</Text>
            {llmReports.length > 0 && (
              <View style={{ backgroundColor: '#27272a', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ color: '#a1a1aa', fontSize: 12, fontWeight: '600' }}>{llmReports.length}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <X size={22} color="#71717a" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
          {llmReports.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 60, gap: 12 }}>
              <Sparkles size={36} color="#3f3f46" />
              <Text style={{ color: '#52525b', fontSize: 14, textAlign: 'center' }}>
                Brak zapisanych analiz AI.{'\n'}Wygeneruj pierwszą analizę poniżej.
              </Text>
            </View>
          ) : (
            llmReports.map((entry) => {
              const meta = entry._meta ?? {};
              const isExpanded = expandedId === meta.id;
              return (
                <View key={meta.id ?? Math.random()} style={{
                  marginBottom: 12, borderRadius: 12, overflow: 'hidden',
                  borderWidth: 1, borderColor: '#27272a', backgroundColor: '#111113',
                }}>
                  {/* Wiersz nagłówka wpisu */}
                  <TouchableOpacity
                    onPress={() => setExpandedId(isExpanded ? null : meta.id)}
                    style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}
                  >
                    <View style={{
                      width: 36, height: 36, borderRadius: 18,
                      backgroundColor: 'rgba(99,102,241,0.15)',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Bot size={18} color="#818cf8" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#e4e4e7', fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
                        {meta.model ?? 'nieznany model'}
                      </Text>
                      <Text style={{ color: '#71717a', fontSize: 12, marginTop: 2 }}>
                        {meta.providerLabel ?? meta.providerId ?? '—'}  ·  {fmtTs(meta.timestamp)}
                      </Text>
                    </View>
                    {isExpanded ? <ChevronUp size={16} color="#52525b" /> : <ChevronDown size={16} color="#52525b" />}
                  </TouchableOpacity>

                  {/* Tokeny */}
                  <View style={{
                    flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingBottom: 12,
                  }}>
                    {[
                      { label: 'prompt', value: meta.promptTokens ?? 0 },
                      { label: 'output', value: meta.completionTokens ?? 0 },
                      { label: 'łącznie', value: meta.totalTokens ?? 0, highlight: true },
                    ].map(({ label, value, highlight }) => (
                      <View key={label} style={{
                        flexDirection: 'row', alignItems: 'center', gap: 4,
                        backgroundColor: highlight ? 'rgba(99,102,241,0.1)' : '#18181b',
                        borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
                      }}>
                        <Zap size={11} color={highlight ? '#818cf8' : '#52525b'} />
                        <Text style={{ color: highlight ? '#818cf8' : '#71717a', fontSize: 11 }}>
                          {value} {label}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Rozwinięta treść */}
                  {isExpanded && (
                    <View style={{ paddingHorizontal: 14, paddingBottom: 16, borderTopWidth: 1, borderColor: '#27272a' }}>
                      <Text style={{ color: '#d4d4d8', fontSize: 13, lineHeight: 20, marginTop: 12 }}>
                        {entry.summary}
                      </Text>
                      {(entry.findings ?? []).length > 0 && (
                        <View style={{ marginTop: 12, gap: 6 }}>
                          <Text style={{ color: '#71717a', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Szczegółowe wnioski
                          </Text>
                          {entry.findings.map((f, i) => (
                            <Text key={i} style={{ color: '#d4d4d8', fontSize: 13, lineHeight: 21 }}>
                              {'• '}{f}
                            </Text>
                          ))}
                        </View>
                      )}
                      {entry.recommendation ? (
                        <View style={{
                          marginTop: 12, padding: 12, borderRadius: 8,
                          backgroundColor: 'rgba(251,113,133,0.08)', borderWidth: 1, borderColor: 'rgba(251,113,133,0.2)',
                        }}>
                          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                            <AlertCircle size={13} color="#fb7185" />
                            <Text style={{ color: '#fb7185', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>Zalecenie</Text>
                          </View>
                          <Text style={{ color: '#d4d4d8', fontSize: 13, lineHeight: 19 }}>{entry.recommendation}</Text>
                        </View>
                      ) : null}

                      {/* Przycisk usunięcia — inline potwierdzenie */}
                      {confirmDeleteId === meta.id ? (
                        <View style={{
                          marginTop: 16, padding: 12, borderRadius: 8,
                          backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
                          gap: 10,
                        }}>
                          <Text style={{ color: '#f87171', fontSize: 13, textAlign: 'center' }}>
                            Na pewno usunąć tę analizę?
                          </Text>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity
                              onPress={() => setConfirmDeleteId(null)}
                              style={{
                                flex: 1, paddingVertical: 8, borderRadius: 6, alignItems: 'center',
                                backgroundColor: '#27272a',
                              }}
                            >
                              <Text style={{ color: '#a1a1aa', fontSize: 13, fontWeight: '600' }}>Anuluj</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleDelete(entry)}
                              style={{
                                flex: 1, paddingVertical: 8, borderRadius: 6, alignItems: 'center',
                                backgroundColor: 'rgba(239,68,68,0.2)',
                              }}
                            >
                              <Text style={{ color: '#f87171', fontSize: 13, fontWeight: '700' }}>Usuń</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={() => setConfirmDeleteId(meta.id)}
                          style={{
                            marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                            gap: 8, paddingVertical: 10, borderRadius: 8,
                            backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
                          }}
                        >
                          <Trash2 size={14} color="#f87171" />
                          <Text style={{ color: '#f87171', fontSize: 13, fontWeight: '600' }}>Usuń analizę</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>

        {/* Przycisk generowania + status na dole */}
        <View style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: 16, paddingBottom: 32, backgroundColor: '#09090b',
          borderTopWidth: 1, borderColor: '#27272a', gap: 10,
        }}>
          {generatingStatus ? (
            <View style={{
              paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10,
              backgroundColor: '#18181b', borderWidth: 1, borderColor: '#3f3f46',
              alignItems: 'center',
            }}>
              <Text style={{ color: '#a1a1aa', fontSize: 13 }}>{generatingStatus}</Text>
            </View>
          ) : null}
          <TouchableOpacity
            onPress={onGenerate}
            disabled={!!generatingStatus}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              paddingVertical: 14, borderRadius: 12, gap: 8,
              backgroundColor: generatingStatus ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.2)',
              borderWidth: 1, borderColor: generatingStatus ? '#3f3f46' : '#6366f1',
            }}
          >
            <Sparkles size={18} color={generatingStatus ? '#52525b' : '#818cf8'} />
            <Text style={{ color: generatingStatus ? '#52525b' : '#818cf8', fontSize: 15, fontWeight: '700' }}>
              {generatingStatus ? 'Generowanie…' : 'Wygeneruj nową analizę'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Główny komponent ─────────────────────────────────────────────────────────

const ReportScreen = ({
  activeReportRecord,
  setView,
  formatDate,
  aiReport,
  setAiReport,
  llmReports = [],
  onDeleteAiReport,
  onGenerateReport,
  isGenerating,
  generatingStatus,
  isAiModalVisible,
  setIsAiModalVisible,
  doctorEmail,
  setDoctorEmail,
  showToast,
  saveToDownloads,
  generatePdfReport,
  formatSDCard,
  bleState
}) => {

  // Stany do obsługi komentarzy w nowym, pływającym oknie (Modal)
  const [eventComments, setEventComments] = useState({});
  const [activeEditIdx, setActiveEditIdx] = useState(null); // Przechowuje ID edytowanego wycinka
  const [draftComment, setDraftComment] = useState("");     // Roboczy tekst komentarza

  if (!activeReportRecord) return null;

  const [isEmailModalVisible, setIsEmailModalVisible] = useState(false);
  const [emailMessage, setEmailMessage] = useState("");
  const [patientEmail, setPatientEmail] = useState("");

  const openEmailModal = () => {
    const dateStr = formatDate(activeReportRecord.date);
    const duration = activeReportRecord.duration;
    // Domyślna, stała treść wiadomości
    setEmailMessage(`Dzień dobry,\n\nPrzesyłam w załączniku raport z badania EKG z dnia ${dateStr}. Czas trwania badania to ${duration}.\n\nBędę wdzięczny/a za analizę i informację zwrotną.`);
    setIsEmailModalVisible(true);
  };

  const handleSendEmail = () => {
    setIsEmailModalVisible(false);
    
    // Jeśli pacjent podał mail zwrotny, doklejamy go do wiadomości
    const finalMessage = patientEmail 
      ? `${emailMessage}\n\nProszę o informację zwrotną na adres: ${patientEmail}` 
      : emailMessage;

    const emailData = {
      doctorEmail: doctorEmail,
      message: finalMessage
    };

    showToast("Przygotowywanie raportu...", "info");
    
    setTimeout(() => {
      generatePdfReport(eventComments, 'email', emailData);
    }, 400);
  };


  const confirmFormatSD = () => {
    if (bleState !== 'connected') {
      showToast('Urządzenie nie jest podłączone (Brak Bluetooth).', 'error');
      return;
    }

    Alert.alert(
      "Formatuj kartę SD",
      "Czy na pewno chcesz BEZPOWROTNIE usunąć całe badanie zapisane na karcie pamięci urządzenia holtera?",
      [
        { text: "Anuluj", style: "cancel" },
        { 
          text: "Usuń badanie", 
          style: "destructive", 
          onPress: () => {
            if (formatSDCard) {
              formatSDCard();
            }
          }
        }
      ]
    );
  };

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
    Keyboard.dismiss();
    setActiveEditIdx(null);
    setDraftComment('');
  };

  const handleSaveEdit = () => {
    Keyboard.dismiss();
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

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
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

          {/* Wycinki EKG */}
          {aiReport && (aiReport.snippets || []).length > 0 && (
            <View style={{ marginTop: 24 }}>
              <View style={[styles.row, { marginBottom: 16 }]}>
                <Activity size={20} color="#fb7185" />
                <Text style={[styles.sectionTitleAi, { marginLeft: 8 }]}>Wycinki EKG</Text>
              </View>
              {(aiReport.snippets || []).map((snippet, idx) => {
                const isImportantEvent = snippet.title.startsWith("Ważne Zdarzenie");
                return (
                  <View key={idx} style={{ marginBottom: 40 }}>
                    <EcgStrip
                      title={snippet.title}
                      description={snippet.description}
                      time={snippet.time}
                      hr={snippet.hr}
                      data={snippet.data}
                    />
                    {isImportantEvent && (
                      <View style={{ marginTop: 8, marginLeft: 16, borderLeftWidth: 2, borderColor: '#4f46e5', paddingLeft: 16 }}>
                        {eventComments[idx] ? (
                          <View style={{ backgroundColor: '#27272a', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#3f3f46', alignItems: 'flex-start' }}>
                            <Text style={{ color: '#a1a1aa', fontWeight: 'bold', fontSize: 10, textTransform: 'uppercase', marginBottom: 4 }}>Komentarz do zdarzenia</Text>
                            <Text style={{ color: '#d4d4d8', fontSize: 13, lineHeight: 18 }}>{eventComments[idx]}</Text>
                            <TouchableOpacity onPress={() => handleOpenEdit(idx)} style={{ alignSelf: 'flex-end', marginTop: 8 }}>
                              <Text style={{ color: '#818cf8', fontSize: 12, fontWeight: 'bold' }}>Edytuj</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity onPress={() => handleOpenEdit(idx)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16, backgroundColor: 'rgba(129,140,248,0.1)', borderRadius: 8, alignSelf: 'flex-start' }}>
                            <Text style={{ color: '#818cf8', fontSize: 12, fontWeight: '600' }}>+ Dodaj komentarz</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Uwaga algorytmiczna */}
          {aiReport && (
            <View style={styles.warningBox}>
              <View style={styles.row}>
                <AlertCircle size={16} color="#fb7185" />
                <Text style={styles.warningTitle}>Ważna uwaga medyczna:</Text>
              </View>
              <Text style={styles.warningText}>{aiReport.recommendation}</Text>
            </View>
          )}
        </View>
      </View>

      {/*SEKCJA EKSPORTU I USUWANIA*/}
      <View style={{ marginTop: 32, paddingHorizontal: 8, paddingBottom: 40 }}>

        {/* Karta Analiz AI */}
        <TouchableOpacity
          onPress={() => setIsAiModalVisible(true)}
          style={{
            marginBottom: 24, borderRadius: 12, borderWidth: 1,
            borderColor: llmReports.length > 0 ? 'rgba(99,102,241,0.4)' : '#27272a',
            backgroundColor: llmReports.length > 0 ? 'rgba(99,102,241,0.08)' : '#111113',
            padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
          }}
        >
          <View style={{
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: llmReports.length > 0 ? 'rgba(99,102,241,0.2)' : '#18181b',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Bot size={20} color={llmReports.length > 0 ? '#818cf8' : '#52525b'} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#e4e4e7', fontSize: 14, fontWeight: '600' }}>Analizy AI</Text>
            <Text style={{ color: llmReports.length > 0 ? '#a1a1aa' : '#52525b', fontSize: 12, marginTop: 2 }}>
              {llmReports.length > 0
                ? `${llmReports.length} ${llmReports.length === 1 ? 'analiza' : llmReports.length < 5 ? 'analizy' : 'analiz'} · dotknij aby zobaczyć`
                : 'Brak analiz — dotknij aby wygenerować'}
            </Text>
          </View>
          {llmReports.length > 0 && (
            <View style={{ backgroundColor: '#6366f1', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{llmReports.length}</Text>
            </View>
          )}
          <ChevronDown size={16} color="#52525b" />
        </TouchableOpacity>

        <Text style={{ color: '#71717a', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 12, marginLeft: 4, letterSpacing: 0.5 }}>
          Udostępnij wynik
        </Text>

        <TouchableOpacity
          onPress={openEmailModal}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            paddingVertical: 14, borderRadius: 12, gap: 8, borderWidth: 1,
            backgroundColor: 'rgba(129, 140, 248, 0.1)',
            borderColor: 'rgba(129, 140, 248, 0.3)',
            marginBottom: 24
          }}
        >
          <Mail size={20} color="#818cf8" />
          <Text style={{ color: '#818cf8', fontSize: 14, fontWeight: '600' }}>Wyślij raport e-mailem</Text>
        </TouchableOpacity>

        <Text style={{ color: '#71717a', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 12, marginLeft: 4, letterSpacing: 0.5 }}>
          Zapis i zarządzanie
        </Text>

        <View style={{ gap: 12 }}>
            
            <TouchableOpacity 
              onPress={() => {
                showToast("Zapisywanie pliku PDF...", "info");
                generatePdfReport(eventComments);
              }} 
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                paddingVertical: 14, borderRadius: 12, gap: 8, borderWidth: 1,
                backgroundColor: 'rgba(129, 140, 248, 0.1)', 
                borderColor: 'rgba(129, 140, 248, 0.3)', 
              }}
            >
              <Download size={20} color="#818cf8" />
              <Text style={{ color: '#818cf8', fontSize: 14, fontWeight: '600' }}>Zapisz raport PDF</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => {
                if (saveToDownloads) {
                   saveToDownloads(activeReportRecord.hourlyTrend);
                } else {
                   showToast("Błąd: Funkcja pobierania niedostępna.", "error");
                }
              }} 
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                paddingVertical: 14, borderRadius: 12, gap: 8, borderWidth: 1,
                backgroundColor: 'rgba(52, 211, 153, 0.1)', 
                borderColor: 'rgba(52, 211, 153, 0.3)', 
              }}
            >
              <FileSpreadsheet size={20} color="#34d399" />
              <Text style={{ color: '#34d399', fontSize: 14, fontWeight: '600' }}>Pobierz pełne badanie (CSV)</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={confirmFormatSD} 
              disabled={bleState !== 'connected'}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                paddingVertical: 14, borderRadius: 12, gap: 8, borderWidth: 1,
                backgroundColor: 'rgba(251, 113, 133, 0.05)', 
                borderColor: 'rgba(251, 113, 133, 0.2)', 
                opacity: bleState === 'connected' ? 1 : 0.5 
              }}
            >
              <Trash2 size={20} color="#fb7185" />
              <Text style={{ color: '#fb7185', fontSize: 14, fontWeight: '600' }}>Usuń badanie z karty SD urządzenia</Text>
            </TouchableOpacity>

        </View>
      </View>
      </ScrollView>

      {/* Modal analiz AI */}
      <AiAnalysesModal
        visible={isAiModalVisible}
        onClose={() => setIsAiModalVisible(false)}
        llmReports={llmReports}
        onDelete={onDeleteAiReport}
        onGenerate={onGenerateReport}
        generatingStatus={generatingStatus}
      />

      {/* MODAL komentarzy */}
      <Modal
        visible={activeEditIdx !== null}
        transparent={true}
        animationType="fade"
      >
        <KeyboardAvoidingView 
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} 
        >
          {/* Tło do zamykania */}
          <View style={{ flex: 1 }} onTouchStart={handleCancelEdit} />
          
          <View style={{ backgroundColor: '#18181b', padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, borderColor: '#3f3f46', borderBottomWidth: 0 }}>
            <Text style={{ color: '#e4e4e7', fontSize: 14, fontWeight: 'bold', marginBottom: 12 }}>
              Komentarz do zdarzenia
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
              placeholder="Napisz, co robiłeś w tej chwili (np. wszedłem po schodach)..."
              placeholderTextColor="#71717a"
              value={draftComment}
              onChangeText={setDraftComment}
              multiline
              autoFocus 
            />
            
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, gap: 12 }}>
              
              <View 
                onTouchStart={handleCancelEdit} 
                style={{ paddingVertical: 10, paddingHorizontal: 16 }}
              >
                <Text style={{ color: '#a1a1aa', fontSize: 14, fontWeight: '600' }}>Anuluj</Text>
              </View>
              
              <View 
                onTouchStart={handleSaveEdit} 
                style={{ backgroundColor: '#818cf8', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 }}
              >
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Zapisz</Text>
              </View>
              
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL DO WYSYŁANIA E-MAILA */}
      <Modal
        visible={isEmailModalVisible}
        transparent={true}
        animationType="slide"
      >
        <KeyboardAvoidingView 
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        >
          <View style={{ backgroundColor: '#18181b', padding: 20, borderRadius: 16, width: '90%', borderWidth: 1, borderColor: '#3f3f46', maxHeight: '80%' }}>
            <Text style={{ color: '#e4e4e7', fontSize: 16, fontWeight: 'bold', marginBottom: 16 }}>
              Wyślij raport e-mailem
            </Text>

            <Text style={{ color: '#a1a1aa', fontSize: 12, marginBottom: 4 }}>Adres e-mail lekarza:</Text>
            <TextInput
              style={{ backgroundColor: '#27272a', color: '#fff', borderRadius: 8, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#3f3f46' }}
              placeholder="np. lekarz@klinika.pl"
              placeholderTextColor="#71717a"
              value={doctorEmail}
              onChangeText={setDoctorEmail}
              keyboardType="email-address"
            />

            <Text style={{ color: '#a1a1aa', fontSize: 12, marginBottom: 4 }}>Twój e-mail (do informacji zwrotnej):</Text>
            <TextInput
              style={{ backgroundColor: '#27272a', color: '#fff', borderRadius: 8, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#3f3f46' }}
              placeholder="np. pacjent@mail.com"
              placeholderTextColor="#71717a"
              value={patientEmail}
              onChangeText={setPatientEmail}
              keyboardType="email-address"
            />

            <Text style={{ color: '#a1a1aa', fontSize: 12, marginBottom: 4 }}>Treść wiadomości:</Text>
            <TextInput
              style={{ backgroundColor: '#27272a', color: '#fff', borderRadius: 8, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: '#3f3f46', minHeight: 120, textAlignVertical: 'top' }}
              multiline
              value={emailMessage}
              onChangeText={setEmailMessage}
            />
            
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <TouchableOpacity onPress={() => setIsEmailModalVisible(false)} style={{ paddingVertical: 10, paddingHorizontal: 16 }}>
                <Text style={{ color: '#a1a1aa', fontSize: 14, fontWeight: '600' }}>Anuluj</Text>
              </TouchableOpacity>
              
              <TouchableOpacity onPress={handleSendEmail} style={{ backgroundColor: '#818cf8', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Send size={16} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Wyślij</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
};

export default ReportScreen;
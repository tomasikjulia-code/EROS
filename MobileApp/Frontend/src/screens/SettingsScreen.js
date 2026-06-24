import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView,
  ActivityIndicator, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Volume2, Bell, Sparkles, Wifi, Save, ChevronRight, X } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { styles } from '../constants/Theme';
import { PROVIDERS, PUBLIC_PROVIDER_IDS, findProvider } from '../config/LlmProviders';
import { ping } from '../utils/LlmClient';

const LLM_CONFIG_KEY = 'llm_config';

// ─── Style lokalne ────────────────────────────────────────────────────────────

const inp = {
  backgroundColor: '#27272a', color: '#e4e4e7', borderRadius: 8,
  padding: 10, borderWidth: 1, borderColor: '#3f3f46',
  fontSize: 13, marginTop: 6,
};
const lbl  = { color: '#a1a1aa', fontSize: 12, marginTop: 14 };
const hint = { color: '#52525b', fontSize: 11, marginTop: 6, fontStyle: 'italic' };

// ─── Modal konfiguracji AI ────────────────────────────────────────────────────

const AiConfigModal = ({ visible, onClose, showToast, onSaved }) => {
  const [providerId, setProviderId] = useState('ollama');
  const [baseUrl,    setBaseUrl]    = useState(PROVIDERS[1].baseUrl);
  const [model,      setModel]      = useState(PROVIDERS[1].defaultModel);
  const [apiKey,     setApiKey]     = useState('');
  const [isTesting,  setIsTesting]  = useState(false);
  const [isSaving,   setIsSaving]   = useState(false);
  // Lokalny status — toast globalny jest niewidoczny pod modalem
  const [status, setStatus] = useState(null); // { type: 'ok'|'err'|'info', msg: string }

  const selectedDef = findProvider(providerId) ?? PROVIDERS[0];
  const isPublic    = PUBLIC_PROVIDER_IDS.includes(providerId);

  // Wczytaj istniejącą konfigurację gdy modal się otwiera
  useEffect(() => {
    if (!visible) return;
    AsyncStorage.getItem(LLM_CONFIG_KEY).then(raw => {
      if (!raw) return;
      try {
        const c = JSON.parse(raw);
        if (c.providerId) setProviderId(c.providerId);
        if (c.baseUrl)    setBaseUrl(c.baseUrl);
        if (c.model)      setModel(c.model);
        if (c.apiKey)     setApiKey(c.apiKey);
      } catch {}
    });
  }, [visible]);

  const handleSelectProvider = (def) => {
    setProviderId(def.id);
    setBaseUrl(def.baseUrl);
    setModel(def.defaultModel);
    setApiKey('');
  };

  const buildConfig = () => ({
    providerId,
    providerLabel: selectedDef.label,
    baseUrl:  baseUrl.trim().replace(/\/$/, ''),
    apiStyle: selectedDef.apiStyle,
    apiKey:   apiKey.trim(),
    model:    model.trim(),
  });

  const handleSave = async () => {
    const config = buildConfig();
    if (!config.baseUrl) { setStatus({ type: 'err', msg: 'Wpisz adres serwera' }); return; }
    if (!config.model)   { setStatus({ type: 'err', msg: 'Wpisz nazwę modelu'  }); return; }
    setIsSaving(true);
    setStatus(null);
    try {
      await AsyncStorage.setItem(LLM_CONFIG_KEY, JSON.stringify(config));
      onSaved?.(config);
      onClose();
      showToast?.('Ustawienia AI zapisane ✓', 'success'); // widoczny po zamknięciu modala
    } catch {
      setStatus({ type: 'err', msg: 'Błąd zapisu ustawień' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    const config = buildConfig();
    if (!config.baseUrl) { setStatus({ type: 'err', msg: 'Wpisz adres serwera' }); return; }
    setIsTesting(true);
    setStatus({ type: 'info', msg: 'Testuję połączenie…' });
    const { ok, detail } = await ping(config);
    setStatus(ok
      ? { type: 'ok',  msg: `✅ Połączenie OK\n${detail}` }
      : { type: 'err', msg: `❌ Serwer nie odpowiada\n${detail}` }
    );
    setIsTesting(false);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#09090b' }}>
        {/* Nagłówek */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 16, paddingVertical: 14,
          borderBottomWidth: 1, borderColor: '#27272a',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ backgroundColor: 'rgba(99,102,241,0.15)', padding: 8, borderRadius: 10 }}>
              <Sparkles size={20} color="#818cf8" />
            </View>
            <View>
              <Text style={{ color: '#e4e4e7', fontSize: 17, fontWeight: '700' }}>Asystent AI</Text>
              <Text style={{ color: '#71717a', fontSize: 12 }}>Konfiguracja dostawcy LLM</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={{ padding: 8 }}>
            <X size={22} color="#71717a" />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Wybór dostawcy */}
            <Text style={{ color: '#71717a', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10 }}>
              DOSTAWCA
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {PROVIDERS.map(def => {
                const active = def.id === providerId;
                return (
                  <TouchableOpacity
                    key={def.id}
                    onPress={() => handleSelectProvider(def)}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
                      borderWidth: 1,
                      backgroundColor: active ? 'rgba(99,102,241,0.18)' : '#18181b',
                      borderColor:     active ? '#6366f1' : '#3f3f46',
                    }}
                  >
                    <Text style={{ color: active ? '#a78bfa' : '#71717a', fontSize: 13, fontWeight: active ? '700' : '400' }}>
                      {def.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Opis dostawcy */}
            <Text style={hint}>{selectedDef.hint}</Text>

            {/* Ostrzeżenie o prywatności */}
            {isPublic && (
              <View style={{
                backgroundColor: 'rgba(251,113,133,0.08)', borderRadius: 10,
                padding: 12, marginTop: 14,
                borderWidth: 1, borderColor: 'rgba(251,113,133,0.25)',
              }}>
                <Text style={{ color: '#fb7185', fontSize: 12, lineHeight: 18 }}>
                  ⚠️  Ten dostawca wysyła dane badania do zewnętrznych serwerów. Dostawca może przechowywać lub wykorzystywać te dane zgodnie z własną polityką prywatności i warunkami zawartej z nim umowy.{'\n\n'}
                  Przy każdym generowaniu raportu pojawi się monit z potwierdzeniem.
                </Text>
              </View>
            )}

            {/* Adres serwera */}
            <Text style={lbl}>Adres serwera (Base URL)</Text>
            <TextInput
              style={inp} value={baseUrl} onChangeText={setBaseUrl}
              placeholder="np. http://localhost:11434"
              placeholderTextColor="#52525b"
              autoCapitalize="none" autoCorrect={false}
            />

            {/* Model */}
            <Text style={lbl}>Model</Text>
            <TextInput
              style={inp} value={model} onChangeText={setModel}
              placeholder="np. gemma3"
              placeholderTextColor="#52525b"
              autoCapitalize="none" autoCorrect={false}
            />

            {/* Sugestie modeli */}
            {(selectedDef.suggestedModels ?? []).length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {selectedDef.suggestedModels.map(m => {
                  const active = model.trim() === m;
                  return (
                    <TouchableOpacity
                      key={m}
                      onPress={() => setModel(m)}
                      style={{
                        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
                        borderWidth: 1,
                        backgroundColor: active ? 'rgba(99,102,241,0.18)' : '#18181b',
                        borderColor:     active ? '#6366f1' : '#3f3f46',
                      }}
                    >
                      <Text style={{ color: active ? '#a78bfa' : '#71717a', fontSize: 12 }}>{m}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Klucz API (warunkowo) */}
            {selectedDef.needsKey && (
              <>
                <Text style={lbl}>Klucz API</Text>
                <TextInput
                  style={inp} value={apiKey} onChangeText={setApiKey}
                  placeholder="sk-..."
                  placeholderTextColor="#52525b"
                  secureTextEntry autoCapitalize="none" autoCorrect={false}
                />
              </>
            )}

            {/* Przyciski */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 28 }}>
              <TouchableOpacity
                onPress={handleTest} disabled={isTesting}
                style={{
                  flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: 6, paddingVertical: 12, borderRadius: 10,
                  borderWidth: 1, borderColor: '#3f3f46', backgroundColor: '#18181b',
                }}
              >
                {isTesting
                  ? <ActivityIndicator size="small" color="#a1a1aa" />
                  : <Wifi size={16} color="#a1a1aa" />}
                <Text style={{ color: '#a1a1aa', fontSize: 14 }}>Testuj</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSave} disabled={isSaving}
                style={{
                  flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: 6, paddingVertical: 12, borderRadius: 10,
                  backgroundColor: 'rgba(99,102,241,0.2)', borderWidth: 1, borderColor: '#6366f1',
                }}
              >
                {isSaving
                  ? <ActivityIndicator size="small" color="#818cf8" />
                  : <Save size={16} color="#818cf8" />}
                <Text style={{ color: '#818cf8', fontSize: 14, fontWeight: '600' }}>Zapisz</Text>
              </TouchableOpacity>
            </View>

            {/* Status testu / zapisu — widoczny wewnątrz modala */}
            {status && (
              <View style={{
                marginTop: 12, padding: 10, borderRadius: 8,
                backgroundColor: status.type === 'ok'   ? 'rgba(52,211,153,0.1)'
                               : status.type === 'err'  ? 'rgba(251,113,133,0.1)'
                               : 'rgba(99,102,241,0.1)',
                borderWidth: 1,
                borderColor:  status.type === 'ok'   ? 'rgba(52,211,153,0.3)'
                            : status.type === 'err'  ? 'rgba(251,113,133,0.3)'
                            : 'rgba(99,102,241,0.3)',
              }}>
                <Text style={{
                  fontSize: 13, lineHeight: 18,
                  color: status.type === 'ok'  ? '#34d399'
                       : status.type === 'err' ? '#fb7185'
                       : '#818cf8',
                }}>
                  {status.msg}
                </Text>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

// ─── Główny ekran ustawień ────────────────────────────────────────────────────

const SettingsScreen = ({
  isVoiceEnabled, handleVoiceToggle,
  isNotifEnabled, setIsNotifEnabled,
  showToast,
}) => {
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [savedConfig,   setSavedConfig]   = useState(null);

  // Wczytaj zapisaną konfigurację (dla podtytułu w wierszu)
  useEffect(() => {
    AsyncStorage.getItem(LLM_CONFIG_KEY).then(raw => {
      if (raw) { try { setSavedConfig(JSON.parse(raw)); } catch {} }
    });
  }, []);

  const aiSubtitle = savedConfig
    ? `${savedConfig.providerLabel ?? savedConfig.providerId} · ${savedConfig.model}`
    : 'Nie skonfigurowano — dotknij aby ustawić';

  const isAiConfigured = !!savedConfig;

  return (
    <View style={styles.screenContent}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Ustawienia</Text>
        <Text style={styles.pageSubtitle}>Dostosuj aplikację do swoich potrzeb.</Text>
      </View>

      {/* ── ASYSTENT AI — pojedynczy wiersz ─────────────── */}
      <Text style={styles.sectionTitle}>ASYSTENT AI</Text>
      <View style={styles.settingCard}>
        <TouchableOpacity style={styles.settingRow} onPress={() => setIsAiModalOpen(true)}>
          <View style={styles.row}>
            <View style={[styles.settingIconBg, isAiConfigured && { backgroundColor: 'rgba(99,102,241,0.15)' }]}>
              <Sparkles size={22} color={isAiConfigured ? '#818cf8' : '#a1a1aa'} />
            </View>
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={styles.settingTitle}>Asystent AI</Text>
              <Text style={[styles.settingSub, !isAiConfigured && { color: '#fb7185' }]} numberOfLines={1}>
                {aiSubtitle}
              </Text>
            </View>
          </View>
          <ChevronRight size={18} color="#52525b" />
        </TouchableOpacity>
      </View>

      {/* ── DOSTĘPNOŚĆ ──────────────────────────────────── */}
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>DOSTĘPNOŚĆ</Text>
      <View style={styles.settingCard}>
        <View style={styles.settingRow}>
          <View style={styles.row}>
            <View style={[styles.settingIconBg, isVoiceEnabled && styles.settingIconBgActive]}>
              <Volume2 size={22} color={isVoiceEnabled ? '#818cf8' : '#a1a1aa'} />
            </View>
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.settingTitle}>Asystent Głosowy</Text>
              <Text style={styles.settingSub}>Odczytuje powiadomienia na głos.</Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleVoiceToggle}
            style={[styles.toggleTrack, isVoiceEnabled && styles.toggleTrackActive]}>
            <View style={[styles.toggleThumb, isVoiceEnabled && styles.toggleThumbActive]} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── POWIADOMIENIA ───────────────────────────────── */}
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>POWIADOMIENIA I SYSTEM</Text>
      <View style={[styles.settingCard, { marginBottom: 40 }]}>
        <View style={styles.settingRow}>
          <View style={styles.row}>
            <View style={[styles.settingIconBg, isNotifEnabled && { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
              <Bell size={22} color={isNotifEnabled ? '#60a5fa' : '#a1a1aa'} />
            </View>
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.settingTitle}>Powiadomienia Push</Text>
              <Text style={styles.settingSub}>Alert o nowym raporcie.</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setIsNotifEnabled(!isNotifEnabled)}
            style={[styles.toggleTrack, isNotifEnabled && { backgroundColor: '#2563eb', borderColor: '#3b82f6' }]}>
            <View style={[styles.toggleThumb, isNotifEnabled && styles.toggleThumbActive]} />
          </TouchableOpacity>
        </View>
      </View>

      </ScrollView>

      {/* ── Modal konfiguracji AI ────────────────────────── */}
      <AiConfigModal
        visible={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        showToast={showToast}
        onSaved={(config) => setSavedConfig(config)}
      />
    </View>
  );
};

export default SettingsScreen;
import { call as llmCall } from './LlmClient';


function parseAiReport(response) {
  if (!response) return null;

  let jsonStr = response.trim();

  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  try {
    return JSON.parse(jsonStr);
  } catch {
    const braceStart = jsonStr.indexOf('{');
    const braceEnd = jsonStr.lastIndexOf('}');
    if (braceStart !== -1 && braceEnd > braceStart) {
      try {
        return JSON.parse(jsonStr.slice(braceStart, braceEnd + 1));
      } catch {}
    }
  }

  return null;
}

function buildPrompt(record, findings) {
  // Formatowanie czasu ms → HH:MM:SS
  const fst = (ms) => {
    if (!ms && ms !== 0) return '--:--:--';
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 3600).toString().padStart(2, '0')}:${Math.floor((s % 3600) / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  };

  // Czas trwania epizodu w czytelnym formacie
  const epDur = (start, end) => {
    const s = Math.round(Math.max(0, (end || 0) - (start || 0)) / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}min ${s % 60}s`;
  };

  // Łączny czas trwania epizodów (burden)
  const burdenFmt = (details) => {
    const totalMs = (details || []).reduce((sum, e) => sum + Math.max(0, (e.end || 0) - (e.start || 0)), 0);
    const s = Math.round(totalMs / 1000);
    if (s === 0) return '0s';
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}min ${s % 60}s`;
    return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}min`;
  };

  // Data i godzina badania
  let recordDate = 'nieznana';
  try {
    if (record.date) {
      const d = new Date(record.date);
      recordDate = d.toLocaleDateString('pl-PL', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    }
  } catch {}

  const bpmRange = (record.maxBpm || 0) - (record.minBpm || 0);

  const tachyDetails     = record.tachyDetails    || [];
  const bradyDetails     = record.bradyDetails    || [];
  const importantDetails = record.importantDetails || [];
  const trend            = record.hourlyTrend     || [];

  // Całkowity czas badania w ms — z ostatniego punktu trendu (najdokładniejsze)
  const totalRecordingMs = trend.length > 0
    ? trend[trend.length - 1].timeMs
    : null;

  // Burden procentowy: ile % czasu badania zajmował dany typ epizodów
  const burdenPct = (details) => {
    if (!totalRecordingMs) return null;
    const totalMs = (details || []).reduce((s, e) => s + Math.max(0, (e.end || 0) - (e.start || 0)), 0);
    return ((totalMs / totalRecordingMs) * 100).toFixed(1);
  };

  const tachyPct     = burdenPct(tachyDetails);
  const bradyPct     = burdenPct(bradyDetails);

  // Wyciąga profil BPM z trendu dla okna czasowego epizodu.
  // Zwraca tekst opisujący kształt krzywej tętna — nagły vs stopniowy onset
  // to kluczowa różnica kliniczna (np. SVT vs tachykardia zatokowa wysiłkowa).
  const episodeProfile = (startMs, endMs) => {
    if (!trend.length) return '';

    const pts = trend.filter(
      p => p.timeMs >= startMs && p.timeMs <= endMs && !p.isNoise && p.bpm >= 25
    );
    if (pts.length < 4) return '';

    // Maksymalnie 18 próbek równomiernie rozłożonych
    const N    = Math.min(18, pts.length);
    const step = pts.length / N;
    const bpms = Array.from({ length: N }, (_, i) => pts[Math.floor(i * step)].bpm);

    const avg = Math.round(bpms.reduce((a, b) => a + b, 0) / N);
    const std = Math.round(Math.sqrt(
      bpms.map(b => (b - avg) ** 2).reduce((a, b) => a + b, 0) / N
    ));

    // Charakter początku i końca epizodu (3 pierwsze / 3 ostatnie próbki)
    const onsetDelta  = bpms[2] - bpms[0];
    const offsetDelta = bpms[N - 1] - bpms[N - 3];
    const onsetLabel  = Math.abs(onsetDelta) >= 15
      ? (onsetDelta > 0 ? `nagły wzrost (+${onsetDelta} BPM)` : `nagły spadek (${onsetDelta} BPM)`)
      : 'stopniowa zmiana';
    const offsetLabel = Math.abs(offsetDelta) >= 15
      ? (offsetDelta < 0 ? `nagłe zakończenie (${offsetDelta} BPM)` : `stopniowe zakończenie (+${offsetDelta} BPM)`)
      : 'stopniowe zakończenie';

    return [
      `  Profil BPM (${N} próbek równomiernych): ${bpms.join(' → ')}`,
      `  Śr. ${avg} BPM, zmienność ±${std} BPM | Onset: ${onsetLabel} | Offset: ${offsetLabel}`,
    ].join('\n');
  };

  const tachyText = tachyDetails.length > 0
    ? tachyDetails.map((e, i) => {
        const profile = episodeProfile(e.start, e.end);
        return [
          `  Epizod tachykardii #${i + 1}: godz. ${fst(e.start)}–${fst(e.end)}, czas: ${epDur(e.start, e.end)}, maks. BPM: ${e.maxBpm}`,
          profile,
        ].filter(Boolean).join('\n');
      }).join('\n\n')
    : '  Brak epizodów tachykardii.';

  const bradyText = bradyDetails.length > 0
    ? bradyDetails.map((e, i) => {
        const profile = episodeProfile(e.start, e.end);
        return [
          `  Epizod bradykardii #${i + 1}: godz. ${fst(e.start)}–${fst(e.end)}, czas: ${epDur(e.start, e.end)}, min. BPM: ${e.minBpm}`,
          profile,
        ].filter(Boolean).join('\n');
      }).join('\n\n')
    : '  Brak epizodów bradykardii.';

  const importantText = importantDetails.length > 0
    ? importantDetails.map((e, i) => {
        const profile = episodeProfile(e.start, e.end);
        return [
          `  Zdarzenie #${i + 1}: godz. ${fst(e.start)}–${fst(e.end)}, czas: ${epDur(e.start, e.end)}, maks. BPM: ${e.maxBpm || '--'}`,
          profile,
        ].filter(Boolean).join('\n');
      }).join('\n\n')
    : '  Pacjent nie oznaczył żadnych zdarzeń podczas badania.';

  const algorithmFindings = (findings || []).filter(Boolean).join('\n');

  return `Jesteś doświadczonym kardiologiem interpretującym wyniki ambulatoryjnego monitorowania EKG metodą Holtera. Poniżej znajdują się dane z automatycznej analizy zapisu. Dokonaj klinicznie użytecznej interpretacji.

Zwróć WYŁĄCZNIE poprawny obiekt JSON — bez markdown, bez tekstu przed ani po:

{
  "summary": "Ogólna ocena badania: opisz dominujący rytm, profil tętna i ogólny charakter zapisu (2-4 zdania).",
  "findings": [
    "Konkretna obserwacja kliniczna z liczbami i godzinami — napisana naturalnie, bez nagłówka «Znalezisko»",
    "Kolejna obserwacja...",
    "..."
  ],
  "recommendation": "Zalecenie kliniczne uwzględniające istotność wyników — wskaż czy konieczna jest konsultacja, i dlaczego (1-2 zdania)."
}

=== INFORMACJE O BADANIU ===
Data i godzina badania: ${recordDate}
Czas trwania rejestracji: ${record.duration}
Całkowita liczba zarejestrowanych uderzeń serca: ${record.totalBeats || 0}

=== PROFIL TĘTNA ===
Tętno średnie:    ${record.avgBpm} BPM
Tętno minimalne:  ${record.minBpm} BPM  (godz. ${record.minBpmTime})
Tętno maksymalne: ${record.maxBpm} BPM  (godz. ${record.maxBpmTime})
Rozpiętość tętna: ${bpmRange} BPM  (wskaźnik zmienności rytmu)

=== TACHYKARDIA (definicja: ≥100 BPM przez co najmniej 30 sekund) ===
Liczba epizodów: ${tachyDetails.length}
Łączny czas w tachykardii: ${burdenFmt(tachyDetails)}${tachyPct !== null ? ` (${tachyPct}% czasu badania)` : ''}
${tachyText}

=== BRADYKARDIA (definicja: <50 BPM przez co najmniej 30 sekund) ===
Liczba epizodów: ${bradyDetails.length}
Łączny czas w bradykardii: ${burdenFmt(bradyDetails)}${bradyPct !== null ? ` (${bradyPct}% czasu badania)` : ''}
${bradyText}

=== ZDARZENIA OZNACZONE PRZEZ PACJENTA ===
Liczba zdarzeń: ${importantDetails.length}
${importantText}

=== WNIOSKI WSTĘPNEJ ANALIZY ALGORYTMICZNEJ ===
${algorithmFindings || 'Brak wniosków algorytmu.'}

=== WYTYCZNE DO INTERPRETACJI ===
- Podawaj konkretne wartości liczbowe i godziny w każdym znalezisku
- Uwzględnij porę doby: bradykardia nocna (godz. 22–06) często jest fizjologiczna
- Skomentuj burden procentowy: tachykardia >10% czasu badania jest klinicznie istotna i wymaga pogłębionej diagnostyki; brady >5% nocna może być fizjologiczna, dzienna — wymaga oceny
- Zdarzenia oznaczone przez pacjenta wymagają komentarza niezależnie od wyniku algorytmu
- Duża rozpiętość tętna (>80 BPM) może sugerować znaczną aktywność fizyczną lub epizody arytmii
- PROFIL BPM: nagły wzrost tętna (≥15 BPM w jednym kroku) sugeruje arytmię napadową (SVT, AF, trzepotanie); stopniowy wzrost sugeruje tachykardię zatokową (wysiłek, stres, gorączka). Nagłe zakończenie epizodu (offset) przemawia za mechanizmem re-entry
- Mała zmienność BPM (±std <5) przy podwyższonym tętnie może wskazywać na rytm ektopowy
- Raport jest informacyjny — zawsze zalecaj konsultację z lekarzem`;
}

/**
 * Wygeneruj raport AI i (na mobile) PDF.
 * @param {object} aiReport           — dane algorytmiczne (findings itp.)
 * @param {object} activeReportRecord — pełny rekord badania
 * @param {object} llmConfig          — konfiguracja dostawcy z AsyncStorage
 * @param {(msg: string) => void} [onProgress] — opcjonalny callback statusu
 * @returns {Promise<{summary, findings, recommendation}>} — odpowiedź modelu
 */
export const generateReport = async (aiReport, activeReportRecord, llmConfig, onProgress) => {
  if (!aiReport)    throw new Error('Brak danych do analizy');
  if (!llmConfig)   throw new Error('Brak konfiguracji dostawcy AI');

  const prompt = buildPrompt(activeReportRecord, aiReport.findings);

  onProgress?.(`📡 Wysyłam dane do ${llmConfig.model ?? 'modelu AI'}…`);
  console.log('[AIService] Wysyłam prompt do', llmConfig.providerId, '/', llmConfig.model);
  const { text: rawResponse, usage } = await llmCall(prompt, llmConfig);

  if (!rawResponse) throw new Error('Brak odpowiedzi z modelu AI');

  onProgress?.('🧠 Przetwarzam odpowiedź modelu…');
  const parsed = parseAiReport(rawResponse);

  if (!parsed || !parsed.summary || !Array.isArray(parsed.findings)) {
    console.error('[AIService] Nieprawidłowy format odpowiedzi:', rawResponse);
    throw new Error('Odpowiedź modelu AI ma nieprawidłowy format JSON');
  }

  return {
    ...parsed,
    _meta: {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      model:            llmConfig.model,
      providerId:       llmConfig.providerId,
      providerLabel:    llmConfig.providerLabel ?? llmConfig.providerId,
      promptTokens:     usage?.promptTokens     ?? 0,
      completionTokens: usage?.completionTokens ?? 0,
      totalTokens:      usage?.totalTokens      ?? 0,
    },
  };
};

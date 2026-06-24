let Speech;
try { Speech = require('expo-speech'); } catch (e) { Speech = null; }

export const analyzeEcgTrend = (parsedTrend) => {
  let minBpm = 999, maxBpm = 0, sumBpm = 0, validBpmCount = 0;
  let minBpmTimeMs = 0, maxBpmTimeMs = 0;

  let tachyDetails = [], bradyDetails = [], importantDetails = [];
  let isCurrentlyTachy = false, tachyStartTime = 0, lastTachyEndTime = 0;
  let isCurrentlyBrady = false, bradyStartTime = 0, lastBradyEndTime = 0;
  let isCurrentlyImportant = false, importantStartTime = 0, importantMaxBpm = 0;

  const MIN_TIME_MS = 30000;
  const MERGE_THRESHOLD_MS = 60000;
  const TACHY_THRESHOLD = 100, TACHY_STOP_THRESHOLD = 90;
  const BRADY_THRESHOLD = 50, BRADY_STOP_THRESHOLD = 55;
  const IGNORE_FIRST_MS = 60000;

  for (let i = 0; i < parsedTrend.length; i++) {
    const point = parsedTrend[i];
    const bpm = point.bpm;
    const timeMs = point.timeMs;

    const isImportant = point.important === true;
    if (!isCurrentlyImportant) {
      if (isImportant) { isCurrentlyImportant = true; importantStartTime = timeMs; importantMaxBpm = bpm; }
    } else {
      if (bpm > importantMaxBpm) importantMaxBpm = bpm;
      if (!isImportant) { isCurrentlyImportant = false; importantDetails.push({ start: importantStartTime, end: timeMs, maxBpm: importantMaxBpm }); }
    }
    if (bpm < 35 || bpm > 220 || point.isNoise) continue;
    if (timeMs < IGNORE_FIRST_MS) continue;

    if (bpm < minBpm) { minBpm = bpm; minBpmTimeMs = timeMs; }
    if (bpm > maxBpm) { maxBpm = bpm; maxBpmTimeMs = timeMs; }
    sumBpm += bpm;
    validBpmCount++;

    if (!isCurrentlyTachy) {
      if (bpm >= TACHY_THRESHOLD) {
        if (tachyStartTime === 0) tachyStartTime = timeMs;
        if (timeMs - tachyStartTime >= MIN_TIME_MS) {
          if (tachyStartTime - lastTachyEndTime > MERGE_THRESHOLD_MS || lastTachyEndTime === 0)
            tachyDetails.push({ start: tachyStartTime, end: 0, maxBpm: bpm });
          isCurrentlyTachy = true;
        }
      } else { tachyStartTime = 0; }
    } else {
      const ci = tachyDetails.length - 1;
      if (bpm > tachyDetails[ci].maxBpm) tachyDetails[ci].maxBpm = bpm;
      if (bpm < TACHY_STOP_THRESHOLD) {
        isCurrentlyTachy = false; lastTachyEndTime = timeMs;
        tachyDetails[tachyDetails.length - 1].end = timeMs; tachyStartTime = 0;
      }
    }

    if (!isCurrentlyBrady) {
      if (bpm <= BRADY_THRESHOLD) {
        if (bradyStartTime === 0) bradyStartTime = timeMs;
        if (timeMs - bradyStartTime >= MIN_TIME_MS) {
          if (bradyStartTime - lastBradyEndTime > MERGE_THRESHOLD_MS || lastBradyEndTime === 0)
            bradyDetails.push({ start: bradyStartTime, end: 0, minBpm: bpm });
          isCurrentlyBrady = true;
        }
      } else { bradyStartTime = 0; }
    } else {
      const ci = bradyDetails.length - 1;
      if (bpm < bradyDetails[ci].minBpm) bradyDetails[ci].minBpm = bpm;
      if (bpm > BRADY_STOP_THRESHOLD) {
        isCurrentlyBrady = false; lastBradyEndTime = timeMs;
        bradyDetails[bradyDetails.length - 1].end = timeMs; bradyStartTime = 0;
      }
    }
  }

  const lastTimeMs = parsedTrend.length > 0 ? parsedTrend[parsedTrend.length - 1].timeMs : 0;
  if (isCurrentlyTachy && tachyDetails.length > 0)      tachyDetails[tachyDetails.length - 1].end = lastTimeMs;
  if (isCurrentlyBrady && bradyDetails.length > 0)      bradyDetails[bradyDetails.length - 1].end = lastTimeMs;
  if (isCurrentlyImportant && parsedTrend.length > 0)   importantDetails.push({ start: importantStartTime, end: lastTimeMs, maxBpm: importantMaxBpm });

  return {
    minBpm: minBpm === 999 ? 0 : Math.floor(minBpm),
    minBpmTimeMs,
    maxBpm: Math.ceil(maxBpm),
    maxBpmTimeMs,
    avgBpm: validBpmCount > 0 ? Math.round(sumBpm / validBpmCount) : 0,
    tachyEpisodes: tachyDetails.length,
    tachyDetails,
    bradyEpisodes: bradyDetails.length,
    bradyDetails,
    importantDetails,
    arrhythmiaEvents: tachyDetails.length + bradyDetails.length,
  };
};

export const formatMsToTime = (ms) => {
  if (!ms && ms !== 0) return "--:--:--";
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
};

export const formatDate = (dateString) =>
  new Date(dateString).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });

export const getEcgSlice = (trend, centerTimeMs, pointsToSide = 150) => {
  const fallback = [0, 10, -10, 10, -10, 0];
  if (!trend || trend.length === 0 || centerTimeMs == null || isNaN(centerTimeMs)) return fallback;

  let lo = 0, hi = trend.length - 1, closestIdx = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (trend[mid].timeMs === centerTimeMs) { closestIdx = mid; break; }
    if (trend[mid].timeMs < centerTimeMs) { lo = mid + 1; closestIdx = mid; }
    else hi = mid - 1;
  }

  const slice = trend.slice(Math.max(0, closestIdx - pointsToSide), Math.min(trend.length, closestIdx + pointsToSide)).map(p => {
    let val = p.ecgRaw ?? p.EKG_Raw;
    if (val === undefined && p.originalLine) val = parseInt(p.originalLine.split(',')[1], 10);
    return (val !== undefined && !isNaN(val)) ? val : 0;
  });

  return slice.length > 2 ? slice : fallback;
};

export const speakReportSummary = (stats, durationMins, durationSecs, isVoiceEnabled) => {
  if (!isVoiceEnabled || !Speech) return;
  Speech.stop();

  const pl = (n, forms) => {
    if (n === 1) return forms[0];
    if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return forms[1];
    return forms[2];
  };

  let text = `Badanie zakończone. Zapisano ${durationMins} ${pl(durationMins, ['minutę','minuty','minut'])} i ${durationSecs} ${pl(durationSecs, ['sekundę','sekundy','sekund'])} pomiaru. `;
  text += `Średnie tętno wyniosło ${stats.avgBpm} Bi Pi Em . `;
  text += `Najniższe zanotowane tętno to ${stats.minBpm}, a najwyższe ${stats.maxBpm} Bi Pi Em . `;

  const arr = stats.arrhythmiaEvents || 0;
  const man = stats.importantDetails?.length || 0;
  if (arr > 0 || man > 0) {
    if (arr > 0) text += `Algorytm wykrył ${arr === 1 ? '' : arr} ${pl(arr, ['jeden epizod arytmii','epizody arytmii','epizodów arytmii'])}. `;
    if (man > 0) text += `Zanotowano ${man === 1 ? '' : man} ${pl(man, ['jedno zdarzenie oznaczone','zdarzenia oznaczone','zdarzeń oznaczonych'])} przez pacjenta. `;
    text += `Sprawdź raport, aby poznać szczegóły.`;
  } else {
    text += `Algorytm nie wykrył żadnych nieprawidłowości.`;
  }

  Speech.speak(text, { language: 'pl-PL', rate: 0.95, pitch: 1.0 });
};

export const migrateLegacyLlmReport = (record) => {
  if (!record?.llmReport) return [];
  return [{ ...record.llmReport, _meta: { id: 'legacy', timestamp: record.date, model: 'nieznany', providerLabel: 'Nieznany', promptTokens: 0, completionTokens: 0, totalTokens: 0 } }];
};

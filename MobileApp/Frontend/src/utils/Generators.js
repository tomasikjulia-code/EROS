import { analyzeEcgTrend, formatMsToTime } from './EcgAnalysis';

export const generateMockEcgStrip = (type) => {
  const data = [];
  let cycleLength = 100;

  if (type === 'tachy') cycleLength = 55;
  if (type === 'brady') cycleLength = 160;

  for (let i = 0; i < 400; i++) {
    const t = i % cycleLength;
    let noise = Math.random() * 4 - 2;
    let val = noise;

    if (type === 'pause' && i > 120 && i < 280) {
      data.push(noise);
      continue;
    }

    if (t > 10 && t < 25) val = 15 * Math.sin((t - 10) * Math.PI / 15) + noise;
    else if (t > 35 && t < 38) val = -15 + noise;
    else if (t >= 38 && t < 42) val = 90 + noise;
    else if (t >= 42 && t < 47) val = -25 + noise;
    else if (t > 60 && t < 85) val = 25 * Math.sin((t - 60) * Math.PI / 25) + noise;

    if (type === 'ves' && i >= 180 && i < 280) {
      if (t > 10 && t < 25) val = noise;
      else if (t >= 25 && t < 55) val = -80 * Math.sin((t - 25) * Math.PI / 30) + noise;
      else if (t > 55 && t < 90) val = 45 * Math.sin((t - 55) * Math.PI / 35) + noise;
      else val = noise;
    }

    data.push(val);
  }

  return data;
};



export const createMockReportRecord = () => {
  const now = new Date();
  const randomMinuteOffset = Math.floor(Math.random() * 121) - 60;
  const durationMinutes = 8 * 60 + randomMinuteOffset;
  const durationMs = durationMinutes * 60 * 1000;
  const durationStr = `${String(Math.floor(durationMinutes / 60)).padStart(2,'0')}:${String(durationMinutes % 60).padStart(2,'0')}:00`;

  const generateEcgSample = (tick) => {
    const noise = (Math.random() + Math.random() - 1) * 280;
    const wander = 400 * Math.sin(tick / 420);
    let value = noise + wander;
    const cycle = tick % 250;
    // Fala P
    if (cycle >= 20 && cycle < 40)  value += 900  * Math.sin((cycle - 20) * Math.PI / 20);
    // Kompleks QRS
    else if (cycle === 50)           value -= 1800;
    else if (cycle === 53)           value += 7800;
    else if (cycle === 56)           value -= 6200;
    // Fala T
    else if (cycle >= 90 && cycle < 130) value += 1800 * Math.sin((cycle - 90) * Math.PI / 40);
    // Co kilkaset uderzeń — mocniejszy QRS (zmienność biologiczna)
    if (tick % 900 > 680) {
      if (cycle === 50) value -= 2500;
      else if (cycle === 55) value += 11000;
      else if (cycle === 65) value -= 8500;
      else if (cycle >= 90 && cycle < 140) value -= 2500 * Math.sin((cycle - 90) * Math.PI / 50);
    }
    // Sporadyczny artefakt ruchowy (co ~3000 ticków, krótki)
    if (tick % 3100 > 3050) value += (Math.random() - 0.5) * 8000;
    return Math.round(value);
  };

  // BPM — Ornstein-Uhlenbeck random walk z fazami doby i epizodami
  const INTERVAL_MS = 120000;
  const totalPoints = Math.ceil(durationMs / INTERVAL_MS);

  // Cel BPM zależny od fazy badania (0=start, 1=koniec)
  const getTargetBpm = (frac) => {
    if (frac < 0.12) return 58;
    if (frac < 0.22) return 54;
    if (frac < 0.40) return 62;
    if (frac < 0.52) return 75;
    if (frac < 0.68) return 82;
    if (frac < 0.78) return 77;
    if (frac < 0.90) return 71;
    return 65;
  };

  // Aktywność fizyczna zależna od fazy
  const getBaseActivity = (frac) => {
    if (frac < 0.40) return 0.8;
    if (frac < 0.52) return 4.0;
    if (frac < 0.68) return 6.5;
    if (frac < 0.78) return 3.5;
    return 2.0;
  };

  let bpmState = 65;
  let nextTachyAt = Math.floor(totalPoints * (0.45 + Math.random() * 0.15));
  let nextBradyAt = Math.floor(totalPoints * (0.10 + Math.random() * 0.25));
  let tachyDuration = 0, bradyDuration = 0;

  const hourlyTrend = Array.from({ length: totalPoints }).map((_, index) => {
    const timeMs = index * INTERVAL_MS;
    const frac = index / (totalPoints - 1);
    // Gauss-like noise (suma 3 uniform → bardziej centralna)
    bpmState += 0.06 * (getTargetBpm(frac) - bpmState) + (Math.random() + Math.random() + Math.random() - 1.5) * 2.8;
    // Epizod tachykardii (jeden, trwa ~6–12 punktów = 12–24 min)
    if (index === nextTachyAt) tachyDuration = 6 + Math.floor(Math.random() * 7);
    if (tachyDuration > 0) { bpmState += 4 + Math.random() * 3; tachyDuration--; }
    // Epizod bradykardii (jeden, trwa ~4–8 punktów = 8–16 min)
    if (index === nextBradyAt) bradyDuration = 4 + Math.floor(Math.random() * 5);
    if (bradyDuration > 0) { bpmState -= 3 + Math.random() * 2; bradyDuration--; }
    const bpm = Math.max(38, Math.min(160, Math.round(bpmState)));
    const actBase = getBaseActivity(frac);
    const activity = Math.max(0, Math.round(actBase + (Math.random() - 0.5) * actBase * 0.7));
    return { time: `${Math.floor(timeMs / 60000)}:${String(Math.floor((timeMs % 60000) / 1000)).padStart(2, '0')}`, bpm, timeMs, activity, ecgRaw: generateEcgSample(index * 7) };
  });

  const stats = analyzeEcgTrend(hourlyTrend);
  return {
    id: `mock-${Date.now()}`,
    date: now.toISOString(),
    duration: durationStr,
    totalBeats: hourlyTrend.length,
    avgBpm: stats.avgBpm,
    minBpm: stats.minBpm,
    minBpmTime: formatMsToTime(stats.minBpmTimeMs),
    minBpmTimeMs: stats.minBpmTimeMs,
    maxBpm: stats.maxBpm,
    maxBpmTime: formatMsToTime(stats.maxBpmTimeMs),
    maxBpmTimeMs: stats.maxBpmTimeMs,
    tachyEpisodes: stats.tachyEpisodes,
    tachyDetails: stats.tachyDetails.length ? stats.tachyDetails : [{ start: Math.floor(durationMs * 0.5), end: Math.floor(durationMs * 0.5) + 60000, maxBpm: 118 }],
    bradyEpisodes: stats.bradyEpisodes,
    bradyDetails: stats.bradyDetails.length ? stats.bradyDetails : [{ start: Math.floor(durationMs * 0.2), end: Math.floor(durationMs * 0.2) + 60000, minBpm: 46 }],
    importantDetails: stats.importantDetails.length ? stats.importantDetails : [{ start: Math.floor(durationMs * 0.65), end: Math.floor(durationMs * 0.65) + 60000, maxBpm: 79 }],
    arrhythmiaEvents: stats.arrhythmiaEvents,
    veb:  { total: 3, pairs: 0, runs: 0, burden: '< 0.1%' },
    sveb: { total: 8, pairs: 0, runs: 0, burden: '< 0.1%' },
    pauses: { count: 1, longest: '2.2s', longestTime: formatMsToTime(Math.floor(durationMs * 0.35)) },
    hourlyTrend,
  };
};

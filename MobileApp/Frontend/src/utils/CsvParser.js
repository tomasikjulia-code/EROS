export const parseEcgFileToTrend = (csvString) => {
  const lines = csvString.trim().split('\n');
  if (lines.length < 2) return [];

  const separator = lines[0].includes(';') ? ';' : ',';
  const trendData = [];

  let firstTimeMs = null;
  const STABILIZATION_PERIOD_MS = 10000; 

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(separator);
    if (parts.length < 3) continue;

    const timeMs = parseInt(parts[0], 10);
    const bpm = parseFloat(parts[2]);

    if (!isNaN(timeMs) && firstTimeMs === null) {
      firstTimeMs = timeMs;
    }

    if (
      !isNaN(timeMs) && 
      !isNaN(bpm) && 
      (timeMs - firstTimeMs > STABILIZATION_PERIOD_MS) && 
      bpm >= 30 && 
      bpm <= 250
    ) {
      trendData.push({ timeMs, bpm });
    }
  }

  return trendData;
};
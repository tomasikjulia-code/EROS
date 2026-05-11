export const parseEcgFileToTrend = (fileContent) => {
  const lines = fileContent.trim().split('\n');
  const trend = [];
  
  let totalActivity = 0;
  let activityCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length >= 5 && parts[4] !== 'B' && !isNaN(parseFloat(parts[4]))) {
      totalActivity += parseFloat(parts[4]);
      activityCount++;
    }
  }
  const averageActivity = activityCount > 0 ? (totalActivity / activityCount) : 0;
  const motionNoiseThreshold = Math.max(averageActivity * 3, 6.0);

  let lastValidActivity = 0;
  let lastValidBpm = 0;
  let lastTimeMs = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('Time') || line.startsWith('Timestamp')) continue;

    const parts = line.split(',');
    
    if (parts.length >= 5) {
      const timeMs = parseInt(parts[0], 10);
      const ecgRaw = parseInt(parts[1], 10);
      const bpm = parseInt(parts[2], 10);
      const leadOff = parseInt(parts[3], 10);
      
      const activityRaw = parts[4].trim();
      let activity = activityRaw === 'B' ? lastValidActivity : parseFloat(activityRaw);
      
      if (!isNaN(activity)) lastValidActivity = activity;

      let isNoise = false;

      // 1. Odpadła elektroda
      if (leadOff === 1) isNoise = true;
      // 2. Ekstremalny ruch
      else if (activity > motionNoiseThreshold) isNoise = true;
      // 3. Sprzeczność: Tętno bliskie zeru, a pacjent się rusza
      else if (bpm < 20 && activity > 1.0) isNoise = true;
      // 4. Błąd odczytu czujnika
      else if (ecgRaw === 0) isNoise = true;
      // 5. Nienaturalny skok tętna (>50 BPM różnicy w czasie krótszym niż 15 sekund)
      else if (lastValidBpm > 0 && Math.abs(bpm - lastValidBpm) > 50 && (timeMs - lastTimeMs) < 15000) isNoise = true;
      // 6. Naturalne granice
      else if (bpm < 20 || bpm > 250) isNoise = true;

      if (!isNoise) {
        lastValidBpm = bpm;
      }
      lastTimeMs = timeMs;

      if (!isNaN(timeMs) && !isNaN(bpm)) {
        trend.push({ 
          timeMs, 
          bpm, 
          activity, 
          isNoise, 
          originalLine: line 
        });
      }
    }
  }
  
  return trend;
};
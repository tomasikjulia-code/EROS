export const parseEcgFileToTrend = (fileContent) => {
  const lines = fileContent.trim().split('\n');
  const trend = [];
  
  let lastValidActivity = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line || line.startsWith('Time') || line.startsWith('Timestamp')) {
      continue;
    }

    const parts = line.split(',');
    
    if (parts.length >= 5) {
      const timeMs = parseInt(parts[0], 10);
      const bpm = parseInt(parts[2], 10);
      
      const activityRaw = parts[4].trim();
      let activity = 0;

      if (activityRaw === 'B') {
        activity = lastValidActivity;
      } else {
        activity = parseFloat(activityRaw);
        
        if (!isNaN(activity)) {
          lastValidActivity = activity;
        } else {
          activity = lastValidActivity;
        }
      }
      if (!isNaN(timeMs) && !isNaN(bpm)) {
        trend.push({ timeMs, bpm, activity });
      }
    }
  }
  
  return trend;
};
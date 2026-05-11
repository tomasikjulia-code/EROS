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

export const generateHourlyTrend = (baseBpm) => {
  return Array.from({ length: 12 }).map((_, i) => ({
    time: `${i * 2}:00`,
    bpm: Math.floor(baseBpm - 15 + Math.random() * 30)
  }));
};

export const initialHistory = [
  { 
    id: '1', 
    date: new Date(Date.now() - 86400000).toISOString(), 
    duration: "23:50:12", 
    totalBeats: 98450, 
    avgBpm: 68, 
    minBpm: 46, 
    minBpmTime: "04:12:05", 
    maxBpm: 128, 
    maxBpmTime: "14:45:22",
    veb: { total: 12, pairs: 0, runs: 0, burden: "< 0.1%" }, 
    sveb: { total: 45, pairs: 2, runs: 0, burden: "0.1%" },
    pauses: { count: 0, longest: "1.8s", longestTime: "03:15:00" }, 
    arrhythmiaEvents: 57, 
    hourlyTrend: generateHourlyTrend(68) 
  },
  { 
    id: '2', 
    date: new Date(Date.now() - 86400000 * 5).toISOString(), 
    duration: "24:00:00", 
    totalBeats: 105600, 
    avgBpm: 74, 
    minBpm: 52, 
    minBpmTime: "02:30:10", 
    maxBpm: 155, 
    maxBpmTime: "17:20:45", 
    veb: { total: 245, pairs: 12, runs: 1, burden: "0.2%" }, 
    sveb: { total: 112, pairs: 5, runs: 2, burden: "0.1%" },
    pauses: { count: 2, longest: "2.6s", longestTime: "04:10:15" }, 
    arrhythmiaEvents: 357, 
    hourlyTrend: generateHourlyTrend(74) 
  }
];
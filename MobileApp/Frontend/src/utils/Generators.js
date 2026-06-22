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


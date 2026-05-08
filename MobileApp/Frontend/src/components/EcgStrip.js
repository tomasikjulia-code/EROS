import React from 'react';
import { View, Text } from 'react-native';
import { Svg, Polyline } from 'react-native-svg';
import { Activity, Clock, Heart } from 'lucide-react-native';
import { styles } from '../constants/Theme';

const EcgStrip = ({ title, description, time, hr, data }) => {
  // zabezpieczenie przezd pusta tablica
  const safeData = data && data.length > 0 ? data : [0, 0];

  // szukanie min i max wartosci
  const minVal = Math.min(...safeData);
  const maxVal = Math.max(...safeData);
  const range = (maxVal - minVal) || 1; 

  // skalowanie
  const points = safeData.map((val, i) => {
    const normalizedY = 190 - ((val - minVal) / range) * 180;
    return `${i},${normalizedY.toFixed(1)}`;
  }).join(' ');
  
  return (
    <View style={styles.ecgContainer}>
      <View style={styles.ecgHeader}>
        <View style={{ flex: 1 }}>
          <View style={styles.row}>
            <Activity size={16} color="#818cf8" />
            <Text style={styles.ecgTitle}>{title}</Text>
          </View>
          <Text style={styles.ecgDescription}>{description}</Text>
        </View>
        
        <View style={styles.ecgBadgesRow}>
           <View style={styles.ecgBadgeDark}>
             <Clock size={12} color="#d4d4d8"/> 
             <Text style={styles.ecgBadgeTextDark}>{time}</Text>
           </View>
           <View style={styles.ecgBadgeRose}>
             <Heart size={12} color="#fb7185"/> 
             <Text style={styles.ecgBadgeTextRose}>HR: {hr} bpm</Text>
           </View>
        </View>
      </View>
      
      <View style={styles.ecgSvgWrapper}>
        <Svg viewBox={`0 0 ${safeData.length} 200`} width="100%" height="100%" preserveAspectRatio="none">
          <Polyline 
            points={points} 
            fill="none" 
            stroke="#34d399" 
            strokeWidth="2.5" 
            strokeLinejoin="round" 
          />
        </Svg>
      </View>
    </View>
  );
};

export default EcgStrip;
import React from 'react';
import { View, Text } from 'react-native';
import { 
  Svg, Polyline, Defs, LinearGradient as SvgLinearGradient, 
  Stop, Polygon, Circle, Line, Text as SvgText 
} from 'react-native-svg';
import { Activity } from 'lucide-react-native';
import { styles } from '../constants/Theme';

const TrendChart = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <View style={[styles.chartContainer, styles.centerAll]}>
        <View style={styles.emptyIconBg}>
          <Activity color="#52525b" size={32} />
        </View>
        <Text style={styles.emptyTextTitle}>Brak danych z ostatnich 24h</Text>
        <Text style={styles.emptyTextSub}>Zsynchronizuj urządzenie, aby zobaczyć wykres</Text>
      </View>
    );
  }
  
  const chartHeight = 150;
  const chartWidth = 300;
  const paddingL = 35; 
  const paddingB = 25;
  
  const minBPM_val = Math.min(...data.map(d => d.bpm));
  const maxBPM_val = Math.max(...data.map(d => d.bpm));

  const yMin = Math.floor((minBPM_val - 10) / 10) * 10;
  const yMax = Math.ceil((maxBPM_val + 10) / 10) * 10;
  const yRange = yMax - yMin || 1;

  const getX = (index) => paddingL + (index / (data.length - 1)) * (chartWidth - paddingL - 10);
  const getY = (bpm) => (chartHeight - paddingB) - ((bpm - yMin) / yRange) * (chartHeight - paddingB - 20);

  const points = data.map((val, i) => `${getX(i)},${getY(val.bpm)}`).join(' ');
  const areaPoints = `${getX(0)},${chartHeight - paddingB} ${points} ${getX(data.length - 1)},${chartHeight - paddingB}`;

  const gridLinesY = [yMin, yMin + yRange / 2, yMax];

  return (
    <View style={styles.chartContainer}>
      <View style={styles.chartHeader}>
        <View style={styles.row}>
          <Activity color="#a78bfa" size={16} />
          <Text style={styles.chartTitle}>Trend dobowy tętna</Text>
        </View>
        <View style={styles.chartBadge}>
          <Text style={styles.chartBadgeText}>{minBPM_val} - {maxBPM_val} BPM</Text>
        </View>
      </View>
      
      <View style={styles.svgWrapper}>
        <Svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} width="100%" height="100%">
          <Defs>
            <SvgLinearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4" />
              <Stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
            </SvgLinearGradient>
          </Defs>

          {gridLinesY.map((bpm, i) => (
            <React.Fragment key={i}>
              <Line 
                x1={paddingL} y1={getY(bpm)} x2={chartWidth} y2={getY(bpm)} 
                stroke="#27272a" strokeWidth="1" strokeDasharray="4,4" 
              />
              <SvgText 
                x={paddingL - 8} y={getY(bpm) + 4} 
                fill="#a1a1aa" fontSize="10" fontWeight="bold" textAnchor="end"
              >
                {Math.round(bpm)}
              </SvgText>
            </React.Fragment>
          ))}
          
          {data.map((val, i) => {
             if (i % 3 === 0 || i === data.length - 1) {
               return (
                <SvgText 
                  key={i} x={getX(i)} y={chartHeight - 5} 
                  fill="#71717a" fontSize="9" fontWeight="600" textAnchor="middle"
                >
                  {val.time}
                </SvgText>
               );
             }
             return null;
          })}

          <Polygon points={areaPoints} fill="url(#chartGradient)" />
          
          <Polyline
            points={points}
            fill="none"
            stroke="#a78bfa"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {data.map((val, i) => (
            <Circle key={i} cx={getX(i)} cy={getY(val.bpm)} r="3" fill="#fff" />
          ))}
        </Svg>
      </View>
    </View>
  );
};

export default TrendChart;
import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { 
  Svg, Path, Defs, LinearGradient as SvgLinearGradient, 
  Stop, Polygon, Circle, Line, Text as SvgText 
} from 'react-native-svg';
import { Activity } from 'lucide-react-native';
import { styles } from '../constants/Theme'; 

const TrendChart = ({ data }) => {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    // Jeśli punktów jest za dużo, decymujemy je (np. zostawiamy 100 kluczowych punktów)
    if (data.length > 100) {
      const step = Math.ceil(data.length / 100);
      const sampled = [];
      for (let i = 0; i < data.length; i += step) {
        sampled.push(data[i]);
      }
      // Zawsze dodajemy ostatni punkt dla zamknięcia wykresu
      if (sampled[sampled.length - 1] !== data[data.length - 1]) {
        sampled.push(data[data.length - 1]);
      }
      return sampled;
    }
    return data;
  }, [data]);

  if (!chartData || chartData.length === 0) {
    return (
      <View style={[styles.chartContainer, styles.centerAll]}>
        <View style={styles.emptyIconBg}>
          <Activity color="#52525b" size={32} />
        </View>
        <Text style={styles.emptyTextTitle}>Brak danych do analizy</Text>
        <Text style={styles.emptyTextSub}>Prześlij plik badania, aby zobaczyć trend tętna</Text>
      </View>
    );
  }
  
  const chartHeight = 160;
  const chartWidth = 320;
  const paddingL = 35; 
  const paddingB = 25;
  const paddingR = 10;
  const paddingT = 10;
  const drawWidth = chartWidth - paddingL - paddingR;
  const drawHeight = chartHeight - paddingB - paddingT;
  
  // Skala Y
  const minBPM = Math.min(...chartData.map(d => d.bpm));
  const maxBPM = Math.max(...chartData.map(d => d.bpm));
  const yMin = Math.max(0, Math.floor((minBPM - 5) / 10) * 10); 
  const yMax = Math.ceil((maxBPM + 5) / 10) * 10;
  const yRange = yMax - yMin || 1;

  const getX = (index) => paddingL + (index / (chartData.length - 1)) * drawWidth;
  const getY = (bpm) => paddingT + drawHeight - ((bpm - yMin) / yRange) * drawHeight;

  // Generowanie Ścieżek
  const pathString = chartData.map((val, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)},${getY(val.bpm)}`).join(' ');
  const areaPoints = `${getX(0)},${chartHeight - paddingB} ${pathString} ${getX(chartData.length - 1)},${chartHeight - paddingB}`;

  // Inteligentne formatowanie osi czasu (X)
  const maxTimeMs = chartData[chartData.length - 1].timeMs;
  
  const formatTimeLabel = (ms) => {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;

    if (maxTimeMs <= 60000) return `${s}s`; // Do 1 minuty 
    if (maxTimeMs <= 3600000) return `${m}:${s.toString().padStart(2, '0')}`; // Do godziny 
    return `${h}:${m.toString().padStart(2, '0')}h`; // Powyżej godziny
  };

  const xAxisLabels = [];
  for (let i = 0; i < 5; i++) {
    const index = Math.floor(i * (chartData.length - 1) / 4);
    xAxisLabels.push({
      x: getX(index),
      label: formatTimeLabel(chartData[index].timeMs)
    });
  }

  // Siatka Y
  const gridLinesY = [yMin, yMin + yRange / 2, yMax];

  return (
    <View style={styles.chartContainer}>
      <View style={styles.chartHeader}>
        <View style={styles.row}>
          <Activity color="#a78bfa" size={16} />
          <Text style={styles.chartTitle}>Trend uderzeń serca (BPM)</Text>
        </View>
        <View style={styles.chartBadge}>
          <Text style={styles.chartBadgeText}>{Math.round(minBPM)} - {Math.round(maxBPM)} BPM</Text>
        </View>
      </View>
      
      <View style={styles.svgWrapper}>
        <Svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} width="100%" height="100%">
          <Defs>
            <SvgLinearGradient id="chartArea" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4" />
              <Stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
            </SvgLinearGradient>
          </Defs>

          {gridLinesY.map((bpm, i) => (
            <React.Fragment key={`grid-${i}`}>
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

          {xAxisLabels.map((lbl, i) => (
             <SvgText 
               key={`time-${i}`} x={lbl.x} y={chartHeight - 5} 
               fill="#71717a" fontSize="9" fontWeight="600" textAnchor="middle"
             >
               {lbl.label}
             </SvgText>
          ))}

          <Polygon points={areaPoints} fill="url(#chartArea)" />

          <Path
            d={pathString}
            fill="none"
            stroke="#6366f1"
            strokeWidth="6"
            opacity="0.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <Path
            d={pathString}
            fill="none"
            stroke="#a78bfa"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {chartData.length < 50 && chartData.map((val, i) => (
            <Circle key={`point-${i}`} cx={getX(i)} cy={getY(val.bpm)} r="3" fill="#fff" />
          ))}
        </Svg>
      </View>
    </View>
  );
};

export default TrendChart;
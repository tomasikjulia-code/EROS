import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { 
  Svg, Path, Defs, LinearGradient as SvgLinearGradient, 
  Stop, Polygon, Line, Text as SvgText 
} from 'react-native-svg';
import { Footprints } from 'lucide-react-native';
import { styles } from '../constants/Theme';

const ActivityChart = ({ data }) => {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    if (data.length > 100) {
      const step = Math.ceil(data.length / 100);
      const sampled = [];
      for (let i = 0; i < data.length; i += step) {
        sampled.push(data[i]);
      }
      if (sampled[sampled.length - 1] !== data[data.length - 1]) {
        sampled.push(data[data.length - 1]);
      }
      return sampled;
    }
    return data;
  }, [data]);

  if (!chartData || chartData.length === 0) return null;
  
  const chartHeight = 160;
  const chartWidth = 320;
  const paddingL = 35; 
  const paddingB = 25;
  const paddingR = 10;
  const paddingT = 10;
  const drawWidth = chartWidth - paddingL - paddingR;
  const drawHeight = chartHeight - paddingB - paddingT;
  
  const maxActivityRaw = Math.max(...chartData.map(d => d.activity));
  const hasActivity = maxActivityRaw > 0;
  const maxActivity = hasActivity ? maxActivityRaw * 1.2 : 1; 
  
  const yMin = 0;
  const yRange = maxActivity - yMin;

  const getX = (index) => paddingL + (index / (chartData.length - 1)) * drawWidth;
  const getY = (activity) => paddingT + drawHeight - ((activity - yMin) / yRange) * drawHeight;

  const pathString = chartData.map((val, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)},${getY(val.activity)}`).join(' ');
  const areaPoints = `${getX(0)},${chartHeight - paddingB} ${pathString} ${getX(chartData.length - 1)},${chartHeight - paddingB}`;

  const maxTimeMs = chartData[chartData.length - 1].timeMs;
  
  const formatTimeLabel = (ms) => {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (maxTimeMs <= 60000) return `${s}s`; 
    if (maxTimeMs <= 3600000) return `${m}:${s.toString().padStart(2, '0')}`; 
    return `${h}:${m.toString().padStart(2, '0')}h`; 
  };

  const xAxisLabels = [];
  for (let i = 0; i < 5; i++) {
    const index = Math.floor(i * (chartData.length - 1) / 4);
    xAxisLabels.push({ x: getX(index), label: formatTimeLabel(chartData[index].timeMs) });
  }

  const gridLinesY = [0, maxActivity / 2, maxActivity];

  return (
    <View style={styles.chartContainer}>
      <View style={styles.chartHeader}>
        <View style={styles.row}>
          <Footprints color="#34d399" size={16} />
          <Text style={styles.chartTitle}>Trend Aktywności</Text>
        </View>
        {/* Usunęliśmy mylący element 'MAX: 100%' - UI jest teraz znacznie czystsze */}
      </View>
      
      <View style={styles.svgWrapper}>
        <Svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} width="100%" height="100%">
          <Defs>
            <SvgLinearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#34d399" stopOpacity="0.4" />
              <Stop offset="100%" stopColor="#34d399" stopOpacity="0.0" />
            </SvgLinearGradient>
          </Defs>

          {gridLinesY.map((act, i) => {
            const percentageLabel = hasActivity 
              ? (i === 0 ? '0%' : i === 1 ? '50%' : '100%') 
              : '0%';
            
            return (
              <React.Fragment key={`grid-${i}`}>
                <Line 
                  x1={paddingL} y1={getY(act)} x2={chartWidth} y2={getY(act)} 
                  stroke="#27272a" strokeWidth="1" strokeDasharray="4,4" 
                />
                <SvgText 
                  x={paddingL - 8} y={getY(act) + 4} 
                  fill="#a1a1aa" fontSize="10" fontWeight="bold" textAnchor="end"
                >
                  {percentageLabel}
                </SvgText>
              </React.Fragment>
            );
          })}
          
          {xAxisLabels.map((lbl, i) => (
             <SvgText 
               key={`time-${i}`} x={lbl.x} y={chartHeight - 5} 
               fill="#71717a" fontSize="9" fontWeight="600" textAnchor="middle"
             >
               {lbl.label}
             </SvgText>
          ))}

          <Polygon points={areaPoints} fill="url(#activityGradient)" />
          
          <Path
            d={pathString}
            fill="none"
            stroke="#6ee7b7"
            strokeWidth="6"
            opacity="0.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <Path
            d={pathString}
            fill="none"
            stroke="#34d399"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
    </View>
  );
};

export default ActivityChart;
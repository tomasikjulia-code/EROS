import React, { useState, useEffect, useRef } from 'react';
import { View, Dimensions, Text } from 'react-native';
import Svg, { Path, Line, Circle, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import { ecgBuffer } from '../utils/EcgBuffer';

const { width } = Dimensions.get('window');
const HEIGHT = 220;
const CHART_WIDTH = Math.floor(width - 32);
const CENTER_Y = HEIGHT / 2;

const LiveEcgChart = ({ isMeasuring }) => {
  const [chartData, setChartData] = useState({ pathString: '', lastX: 0, lastY: CENTER_Y });
  const maxAmplitude = useRef(8000); 

  useEffect(() => {
    if (!isMeasuring) return;

    const renderLoop = setInterval(() => {
      const snapshot = ecgBuffer.getSnapshot();
      let localMax = 0;
      
      for (let i = 0; i < snapshot.length; i++) {
        let val = snapshot[i] || 0;
        if (val < 0) val = -val;
        if (val > localMax) localMax = val;
      }
      
      if (localMax > maxAmplitude.current) {
        maxAmplitude.current = maxAmplitude.current * 0.9 + localMax * 0.1;
      }

      const scaleY = (CENTER_Y * 0.8) / maxAmplitude.current;
      const stepX = CHART_WIDTH / (snapshot.length - 1); 
      const pathArray = [];
      const stepSize = 3; 

      for (let i = 0; i < snapshot.length - stepSize; i += stepSize) {
        let minVal = snapshot[i] || 0;
        let maxVal = snapshot[i] || 0;
        let minIdx = i;
        let maxIdx = i;

        for (let j = 1; j < stepSize; j++) {
          let val = snapshot[i + j] || 0;
          if (val < minVal) { minVal = val; minIdx = i + j; }
          if (val > maxVal) { maxVal = val; maxIdx = i + j; }
        }

        if (minIdx < maxIdx) {
          pathArray.push(`${Math.round(minIdx * stepX * 10) / 10},${Math.round((CENTER_Y - minVal * scaleY) * 10) / 10}`);
          pathArray.push(`${Math.round(maxIdx * stepX * 10) / 10},${Math.round((CENTER_Y - maxVal * scaleY) * 10) / 10}`);
        } else {
          pathArray.push(`${Math.round(maxIdx * stepX * 10) / 10},${Math.round((CENTER_Y - maxVal * scaleY) * 10) / 10}`);
          pathArray.push(`${Math.round(minIdx * stepX * 10) / 10},${Math.round((CENTER_Y - minVal * scaleY) * 10) / 10}`);
        }
      }

      const lastIdx = snapshot.length - 1;
      const finalX = lastIdx * stepX;
      const finalY = CENTER_Y - ((snapshot[lastIdx] || 0) * scaleY);
      pathArray.push(`${Math.round(finalX * 10) / 10},${Math.round(finalY * 10) / 10}`);

      setChartData({
        pathString: 'M ' + pathArray.join(' L '), 
        lastX: finalX,
        lastY: finalY
      });

    }, 40); 

    return () => clearInterval(renderLoop);
  }, [isMeasuring]);

  const distanceFromCenter = Math.abs(CENTER_Y - chartData.lastY);
  const dynamicGlowRadius = 14 + (distanceFromCenter * 0.15); 

  const renderMedicalGrid = () => {
    const gridLines = [];
    const minorStep = HEIGHT / 25; 
    
    for (let i = 0; i <= 25; i++) {
      const y = i * minorStep;
      const isMajor = i % 5 === 0;
      gridLines.push(
        <Line 
          key={`h${i}`} x1="0" y1={y} x2={CHART_WIDTH} y2={y} 
          stroke={isMajor ? "#27272a" : "#18181b"} 
          strokeWidth={isMajor ? "1.5" : "0.5"} 
        />
      );
    }
    const vSteps = Math.floor(CHART_WIDTH / minorStep);
    for (let i = 0; i <= vSteps; i++) {
      const x = i * minorStep;
      const isMajor = i % 5 === 0;
      gridLines.push(
        <Line 
          key={`v${i}`} x1={x} y1="0" x2={x} y2={HEIGHT} 
          stroke={isMajor ? "#27272a" : "#18181b"} 
          strokeWidth={isMajor ? "1.5" : "0.5"} 
        />
      );
    }
    return gridLines;
  };

  const displayMv = (maxAmplitude.current / 4000).toFixed(1);

  return (
    <View style={{ 
      height: HEIGHT, 
      backgroundColor: '#050505', 
      borderRadius: 16, 
      borderWidth: 1, 
      borderColor: '#27272a',
      overflow: 'hidden',
      position: 'relative'
    }}>
      
      <View style={{ position: 'absolute', top: 10, left: 10, zIndex: 10 }}>
        <Text style={{ color: '#71717a', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>+{displayMv} mV</Text>
      </View>
      <View style={{ position: 'absolute', bottom: 10, left: 10, zIndex: 10 }}>
        <Text style={{ color: '#71717a', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>-{displayMv} mV</Text>
      </View>
      <View style={{ position: 'absolute', bottom: 10, right: 10, zIndex: 10 }}>
        <Text style={{ color: '#71717a', fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>ZAPIS NA ŻYWO (250Hz)</Text>
      </View>

      <Svg width={CHART_WIDTH} height={HEIGHT}>
        <Defs>
          <LinearGradient id="fadeGradient" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#7c3aed" stopOpacity="0" />
            <Stop offset="0.2" stopColor="#7c3aed" stopOpacity="0.035" />
            <Stop offset="0.5" stopColor="#9333ea" stopOpacity="0.21" />
            <Stop offset="1" stopColor="#a855f7" stopOpacity="0.35" />
          </LinearGradient>
          
          <LinearGradient id="coreGradient" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#9333ea" stopOpacity="0" />
            <Stop offset="0.15" stopColor="#9333ea" stopOpacity="0.2" />
            <Stop offset="0.4" stopColor="#a855f7" stopOpacity="0.9" />
            <Stop offset="1" stopColor="#c084fc" stopOpacity="1" />
          </LinearGradient>
        </Defs>

        <G>
          {renderMedicalGrid()}
          <Line x1="0" y1={CENTER_Y} x2={CHART_WIDTH} y2={CENTER_Y} stroke="#3f3f46" strokeWidth="1.5" strokeDasharray="4 4" />
        </G>

        {chartData.pathString !== '' && (
          <G>
            <Path 
              d={chartData.pathString} 
              stroke="rgba(124, 58, 237, 0.05)" 
              strokeWidth="22" 
              fill="none" 
              strokeLinejoin="round" 
              strokeLinecap="round" 
            />

            <Path 
              d={chartData.pathString} 
              stroke="url(#fadeGradient)" 
              strokeWidth="8" 
              fill="none" 
              strokeLinejoin="round" 
              strokeLinecap="round" 
            />
            
            <Path 
              d={chartData.pathString} 
              stroke="url(#coreGradient)" 
              strokeWidth="2.5" 
              fill="none" 
              strokeLinejoin="round" 
              strokeLinecap="round" 
            />

            <Circle cx={chartData.lastX} cy={chartData.lastY} r={dynamicGlowRadius} fill="rgba(168, 85, 247, 0.2)" />
            <Circle cx={chartData.lastX} cy={chartData.lastY} r="5" fill="rgba(192, 132, 252, 0.8)" />
            <Circle cx={chartData.lastX} cy={chartData.lastY} r="2.5" fill="#f3e8ff" />
          </G>
        )}
      </Svg>
    </View>
  );
};

export default LiveEcgChart;
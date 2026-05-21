import React, { useMemo, useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, Platform, StatusBar, useWindowDimensions, StyleSheet } from 'react-native';
import { 
  Svg, Path, Defs, LinearGradient as SvgLinearGradient, 
  Stop, Polygon, Circle, Line, Text as SvgText 
} from 'react-native-svg';
import { Activity } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { styles } from '../constants/Theme'; 

const TrendChart = ({ data }) => {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isPortrait = windowHeight >= windowWidth;

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRotated, setIsRotated] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });
  const [fsChartSize, setFsChartSize] = useState({ width: 0, height: 0 });

  const activeZoom = isFullscreen ? zoomLevel : 1;
  
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    const targetPoints = 100 * activeZoom;
    if (data.length > targetPoints) {
      const step = Math.ceil(data.length / targetPoints);
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
  }, [data, activeZoom]);

  if (!chartData || chartData.length === 0) {
    return (
      <View style={[styles.chartContainer, styles.centerAll, { height: 160 }]}>
        <View style={styles.emptyIconBg}>
          <Activity color="#52525b" size={32} />
        </View>
        <Text style={styles.emptyTextTitle}>Brak danych do analizy</Text>
        <Text style={styles.emptyTextSub}>Prześlij plik badania, aby zobaczyć trend tętna</Text>
      </View>
    );
  }
  
  const minBPM = Math.min(...chartData.map(d => d.bpm));
  const maxBPM = Math.max(...chartData.map(d => d.bpm));
  const yMin = Math.max(0, Math.floor((minBPM - 5) / 10) * 10); 
  const yMax = Math.ceil((maxBPM + 5) / 10) * 10;
  const yRange = yMax - yMin || 1;

  const getSafePaddings = () => {
    const androidTop = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;
    if (isRotated && isPortrait) {
      return { pt: Math.max(insets.right, 12), pb: Math.max(insets.left, 16), pl: Math.max(insets.top, androidTop, 16), pr: Math.max(insets.bottom, 16) };
    }
    return { pt: Math.max(insets.top, androidTop, 12), pb: Math.max(insets.bottom, 24), pl: Math.max(insets.left, 10), pr: Math.max(insets.right, 10) };
  };
  const safePad = getSafePaddings();

  const renderChart = (isFS, W, H) => {
    const chartWidth = W * (isFS ? zoomLevel : 1);
    const paddingL = 35, paddingB = 28, paddingR = 10, paddingT = 10;
    const drawWidth = chartWidth - paddingL - paddingR;
    const drawHeight = H - paddingB - paddingT;
    
    const getX = (index) => paddingL + (index / Math.max(1, chartData.length - 1)) * drawWidth;
    const getY = (bpm) => paddingT + drawHeight - ((bpm - yMin) / yRange) * drawHeight;

    const areaPathString = chartData.map((val, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)},${getY(val.bpm)}`).join(' ');
    const areaPoints = `${getX(0)},${H - paddingB} ${areaPathString} ${getX(chartData.length - 1)},${H - paddingB}`;

    const segments = [];
    if (chartData.length > 0) {
      let currentPoints = [{ ...chartData[0], originalIndex: 0 }];
      for (let i = 1; i < chartData.length; i++) {
        const point = { ...chartData[i], originalIndex: i };
        if (chartData[i].isNoise === chartData[i - 1].isNoise) {
          currentPoints.push(point);
        } else {
          currentPoints.push(point);
          segments.push({ isNoise: chartData[i - 1].isNoise, points: currentPoints });
          currentPoints = [point];
        }
      }
      segments.push({ isNoise: chartData[chartData.length - 1].isNoise, points: currentPoints });
    }

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

    const numLabels = isFS ? Math.max(5, 5 * zoomLevel) : 5;
    const xAxisLabels = [];
    for (let i = 0; i < numLabels; i++) {
      const index = Math.floor(i * (chartData.length - 1) / (numLabels - 1));
      xAxisLabels.push({ x: getX(index), label: formatTimeLabel(chartData[index].timeMs) });
    }

    const gridLinesY = [yMin, yMin + yRange / 2, yMax];

    return (
      <View style={{ flex: 1, position: 'relative' }}>
        {/* WARSTWA SCROLLOWANA (Wykres) */}
        <ScrollView horizontal showsHorizontalScrollIndicator={isFS} bounces={false} style={{ flex: 1 }}>
          <View style={{ width: chartWidth, height: H }}>
            <Svg viewBox={`0 0 ${chartWidth} ${H}`} width="100%" height="100%">
              <Defs>
                <SvgLinearGradient id="chartArea" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4" />
                  <Stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
                </SvgLinearGradient>
              </Defs>

              {/* Rysowanie tylko poziomych linii siatki */}
              {gridLinesY.map((bpm, i) => (
                <Line key={`grid-${i}`} x1={paddingL} y1={getY(bpm)} x2={chartWidth} y2={getY(bpm)} stroke="#27272a" strokeWidth="1" strokeDasharray="4,4" />
              ))}

              {/* Oś czasu na dole */}
              {xAxisLabels.map((lbl, i) => {
                 const isFirst = i === 0;
                 const isLast = i === xAxisLabels.length - 1;
                 return (
                   <SvgText 
                     key={`time-${i}`} 
                     x={isFirst ? lbl.x + 4 : isLast ? lbl.x - 4 : lbl.x} 
                     y={H - 8} 
                     fill="#71717a" 
                     fontSize="9" 
                     fontWeight="600" 
                     textAnchor={isFirst ? "start" : isLast ? "end" : "middle"}
                   >
                     {lbl.label}
                   </SvgText>
                 );
              })}

              <Polygon points={areaPoints} fill="url(#chartArea)" />

              {segments.map((seg, index) => {
                const segPath = seg.points.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${getX(pt.originalIndex)},${getY(pt.bpm)}`).join(' ');
                return (
                  <React.Fragment key={`segment-${index}`}>
                    {!seg.isNoise && <Path d={segPath} fill="none" stroke="#6366f1" strokeWidth="6" opacity="0.2" strokeLinecap="round" strokeLinejoin="round" />}
                    <Path d={segPath} fill="none" stroke={seg.isNoise ? "#52525b" : "#a78bfa"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={seg.isNoise ? "5,5" : "none"} />
                  </React.Fragment>
                );
              })}
              
              {chartData.length / activeZoom < 50 && chartData.map((val, i) => (
                <Circle key={`point-${i}`} cx={getX(i)} cy={getY(val.bpm)} r="3" fill="#fff" />
              ))}
            </Svg>
          </View>
        </ScrollView>

        {/* WARSTWA WIERZCHNIA (Przyklejona Oś Y) */}
        <View style={{ 
          position: 'absolute', 
          left: 0, 
          top: 0, 
          bottom: 0, 
          width: paddingL, 
          // KLUCZOWA ZMIANA: Tło tylko w trybie pełnego ekranu
          backgroundColor: isFS ? '#09090b' : 'transparent',
          borderRightWidth: isFS ? 1 : 0,
          borderColor: '#27272a',
          zIndex: 10
        }}>
          <Svg width={paddingL} height={H}>
            {gridLinesY.map((bpm, i) => (
              <SvgText key={`ytxt-${i}`} x={paddingL - 6} y={getY(bpm) + 4} fill="#a1a1aa" fontSize="10" fontWeight="bold" textAnchor="end">
                {Math.round(bpm)}
              </SvgText>
            ))}
          </Svg>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.chartContainer}>
      <View style={styles.chartHeader}>
        <View style={styles.row}>
          <Activity color="#a78bfa" size={16} />
          <Text style={styles.chartTitle}>Trend uderzeń serca</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={styles.chartBadge}>
            <Text style={styles.chartBadgeText}>{Math.round(minBPM)} - {Math.round(maxBPM)} BPM</Text>
          </View>
          <Pressable onPress={() => setIsFullscreen(true)} style={localStyles.badgeBtn}>
             <Text style={localStyles.badgeBtnText}>⛶</Text>
          </Pressable>
        </View>
      </View>
      
      {/* NORMALNY WIDOK */}
      <View style={{ height: 160, width: '100%', overflow: 'hidden' }} onLayout={(e) => setChartSize(e.nativeEvent.layout)}>
        {chartSize.width > 0 && renderChart(false, chartSize.width, chartSize.height)}
      </View>

      {/* PEŁNY EKRAN */}
      <Modal visible={isFullscreen} animationType="fade" transparent={false} supportedOrientations={['portrait', 'landscape']}>
        <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{
            width: isRotated ? Math.max(windowWidth, windowHeight) : '100%',
            height: isRotated ? Math.min(windowWidth, windowHeight) : '100%',
            transform: isRotated ? [{ rotate: '90deg' }] : [],
            backgroundColor: '#050505',
            flexDirection: 'column',
          }}>
            
            <View style={{ flex: 1, paddingTop: safePad.pt, paddingLeft: safePad.pl, paddingRight: safePad.pr }}>
              <View style={{ flex: 1, overflow: 'hidden', borderRadius: 8, borderWidth: 1, borderColor: '#27272a', backgroundColor: '#09090b', position: 'relative' }} onLayout={(e) => setFsChartSize(e.nativeEvent.layout)}>
                <View style={{ position: 'absolute', top: 12, right: 12, zIndex: 20 }}>
                  <View style={[styles.chartBadge, { backgroundColor: 'rgba(39, 39, 42, 0.8)', borderWidth: 1, borderColor: '#3f3f46' }]}>
                    <Text style={styles.chartBadgeText}>{Math.round(minBPM)} - {Math.round(maxBPM)} BPM</Text>
                  </View>
                </View>
                {fsChartSize.width > 0 && renderChart(true, fsChartSize.width, fsChartSize.height)}
              </View>
            </View>

            {/* SYMETRYCZNY PANEL KONTROLNY */}
            <View style={[localStyles.controlPanel, { paddingBottom: safePad.pb, paddingLeft: safePad.pl, paddingRight: safePad.pr }]}>
              <View style={{ width: 44 }}>
                {isPortrait && (
                  <Pressable onPress={() => setIsRotated(!isRotated)} style={localStyles.squareBtn}>
                    <Text style={localStyles.squareBtnIcon}>↻</Text>
                  </Pressable>
                )}
              </View>

              <View style={localStyles.zoomControls}>
                <Pressable onPress={() => setZoomLevel(p => Math.max(1, p - 1))} style={localStyles.zoomBtn}>
                  <Text style={localStyles.zoomBtnText}>-</Text>
                </Pressable>
                <View style={{ width: 44, alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>{zoomLevel}x</Text>
                </View>
                <Pressable onPress={() => setZoomLevel(p => Math.min(10, p + 1))} style={localStyles.zoomBtn}>
                  <Text style={localStyles.zoomBtnText}>+</Text>
                </Pressable>
              </View>

              <View style={{ width: 44 }}>
                <Pressable onPress={() => { setIsFullscreen(false); setIsRotated(false); setZoomLevel(1); }} style={[localStyles.squareBtn, { backgroundColor: '#e11d48' }]}>
                  <Text style={localStyles.squareBtnIcon}>✕</Text>
                </Pressable>
              </View>
            </View>

          </View>
        </View>
      </Modal>
    </View>
  );
};

const localStyles = StyleSheet.create({
  badgeBtn: { backgroundColor: '#27272a', width: 28, height: 28, borderRadius: 6, marginLeft: 8, justifyContent: 'center', alignItems: 'center' },
  badgeBtnText: { color: '#a1a1aa', fontSize: 16, fontWeight: 'bold' },
  controlPanel: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#18181b', borderTopWidth: 1, borderColor: '#27272a' },
  zoomControls: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#27272a', borderRadius: 8, padding: 4 },
  zoomBtn: { width: 36, height: 36, backgroundColor: '#3f3f46', justifyContent: 'center', alignItems: 'center', borderRadius: 6 },
  zoomBtnText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  squareBtn: { width: 44, height: 44, backgroundColor: '#3f3f46', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  squareBtnIcon: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});

export default TrendChart;
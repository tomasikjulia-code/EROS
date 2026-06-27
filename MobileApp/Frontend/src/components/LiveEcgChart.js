import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, Platform, StatusBar, useWindowDimensions } from 'react-native';
import Svg, { Path, Line, Circle, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ecgBuffer } from '../utils/EcgBuffer';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SAMPLE_RATE = 250;
const MIN_AMPLITUDE_RANGE = 2000;

// Trzymamy zoom globalnie, żeby nie resetował się przy zmianie zakładki
let globalZoomLevel = 350;

const LiveEcgChart = ({ isMeasuring }) => {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isPortrait = windowHeight >= windowWidth;

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRotated, setIsRotated] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(globalZoomLevel);
  
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });
  const [chartData, setChartData] = useState({ pathString: '', lastX: 0, lastY: 0 });
  
  const smoothedMin = useRef(-1000);
  const smoothedMax = useRef(1000);
  const zoomRef = useRef(globalZoomLevel);
  const sizeRef = useRef({ width: 0, height: 0 });

  // Wczytanie zapisanego przybliżenia z pamięci przy pierwszym renderze
  useEffect(() => {
    AsyncStorage.getItem('@rythmio_live_zoom').then((savedZoom) => {
      if (savedZoom !== null) {
        const parsedZoom = parseInt(savedZoom, 10);
        setZoomLevel(parsedZoom);
        globalZoomLevel = parsedZoom;
      }
    });
  }, []);

  const handleZoomChange = (newZoom) => {
    setZoomLevel(newZoom);
    globalZoomLevel = newZoom; 
    // Zapisujemy trwale w telefonie
    AsyncStorage.setItem('@rythmio_live_zoom', newZoom.toString());
  };

  useEffect(() => {
    zoomRef.current = zoomLevel;
  }, [zoomLevel]);

  useEffect(() => {
    sizeRef.current = chartSize;
  }, [chartSize]);

  useEffect(() => {
    if (!isMeasuring) {
      return;
    }

    const renderLoop = setInterval(() => {
      const W = sizeRef.current.width;
      const H = sizeRef.current.height;
      
      if (W === 0 || H === 0) return;

      const snapshot = ecgBuffer.getSnapshot();
      if (!snapshot || snapshot.length === 0) return;

      const visibleSamples = Math.floor((W / zoomRef.current) * SAMPLE_RATE);
      const displaySnapshot = snapshot.length > visibleSamples 
        ? snapshot.slice(-visibleSamples) 
        : snapshot;

      let localMin = displaySnapshot[0] || 0;
      let localMax = displaySnapshot[0] || 0;
      
      for (let i = 1; i < displaySnapshot.length; i++) {
        const val = displaySnapshot[i] || 0;
        if (val < localMin) localMin = val;
        if (val > localMax) localMax = val;
      }

      if (localMax - localMin < MIN_AMPLITUDE_RANGE) {
        const mid = (localMax + localMin) / 2;
        localMax = mid + MIN_AMPLITUDE_RANGE / 2;
        localMin = mid - MIN_AMPLITUDE_RANGE / 2;
      }

      smoothedMin.current = smoothedMin.current * 0.9 + localMin * 0.1;
      smoothedMax.current = smoothedMax.current * 0.9 + localMax * 0.1;

      const PADDING_Y = H * 0.15; 
      const USABLE_HEIGHT = H - (PADDING_Y * 2);
      const rangeY = smoothedMax.current - smoothedMin.current;

      const effectiveLength = Math.max(displaySnapshot.length, visibleSamples);
      const stepX = W / (effectiveLength - 1); 
      
      const pathArray = [];
      const stepSize = visibleSamples < 300 ? 1 : 2; 

      for (let i = 0; i < displaySnapshot.length - stepSize; i += stepSize) {
        let minVal = displaySnapshot[i] || 0;
        let maxVal = displaySnapshot[i] || 0;
        let minIdx = i;
        let maxIdx = i;

        for (let j = 1; j < stepSize; j++) {
          let val = displaySnapshot[i + j] || 0;
          if (val < minVal) { minVal = val; minIdx = i + j; }
          if (val > maxVal) { maxVal = val; maxIdx = i + j; }
        }

        const y1 = H - PADDING_Y - ((minVal - smoothedMin.current) / rangeY) * USABLE_HEIGHT;
        const y2 = H - PADDING_Y - ((maxVal - smoothedMin.current) / rangeY) * USABLE_HEIGHT;
        const x1 = minIdx * stepX;
        const x2 = maxIdx * stepX;

        if (minIdx < maxIdx) {
          pathArray.push(`${x1.toFixed(1)},${y1.toFixed(1)}`);
          pathArray.push(`${x2.toFixed(1)},${y2.toFixed(1)}`);
        } else {
          pathArray.push(`${x2.toFixed(1)},${y2.toFixed(1)}`);
          pathArray.push(`${x1.toFixed(1)},${y1.toFixed(1)}`);
        }
      }

      const lastIdx = displaySnapshot.length - 1;
      const finalX = lastIdx * stepX;
      const finalVal = displaySnapshot[lastIdx] || 0;
      const finalY = H - PADDING_Y - ((finalVal - smoothedMin.current) / rangeY) * USABLE_HEIGHT;
      pathArray.push(`${finalX.toFixed(1)},${finalY.toFixed(1)}`);

      setChartData({
        pathString: 'M ' + pathArray.join(' L '), 
        lastX: finalX,
        lastY: finalY
      });

    }, 40); 

    return () => clearInterval(renderLoop);
  }, [isMeasuring]); 

  const renderMedicalGrid = (W, H) => {
    if (W === 0 || H === 0) return null;
    const gridLines = [];
    const minorStep = 15; 
    
    const hSteps = Math.floor(H / minorStep);
    for (let i = 0; i <= hSteps; i++) {
      const y = i * minorStep;
      const isMajor = i % 5 === 0;
      gridLines.push(
        <Line key={`h${i}`} x1="0" y1={y} x2={W} y2={y} stroke={isMajor ? "#27272a" : "#18181b"} strokeWidth={isMajor ? "1.5" : "0.5"} />
      );
    }
    const vSteps = Math.floor(W / minorStep);
    for (let i = 0; i <= vSteps; i++) {
      const x = i * minorStep;
      const isMajor = i % 5 === 0;
      gridLines.push(
        <Line key={`v${i}`} x1={x} y1="0" x2={x} y2={H} stroke={isMajor ? "#27272a" : "#18181b"} strokeWidth={isMajor ? "1.5" : "0.5"} />
      );
    }

    gridLines.push(<Line key="v_end" x1={W} y1="0" x2={W} y2={H} stroke="#27272a" strokeWidth="1.5" />);
    gridLines.push(<Line key="h_end" x1="0" y1={H} x2={W} y2={H} stroke="#27272a" strokeWidth="1.5" />);

    return gridLines;
  };

  const getSafePaddings = () => {
    if (!isFullscreen) return { pt: 0, pb: 12, pl: 12, pr: 12 };

    const androidTop = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;

    if (isRotated && isPortrait) {
      return {
        pt: Math.max(insets.right, 12), 
        pb: Math.max(insets.left, 16),  
        pl: Math.max(insets.top, androidTop, 16), 
        pr: Math.max(insets.bottom, 16), 
      };
    } else {
      return {
        pt: Math.max(insets.top, androidTop, 12),
        pb: Math.max(insets.bottom, 24), 
        pl: Math.max(insets.left, 10),
        pr: Math.max(insets.right, 10),
      };
    }
  };

  const safePad = getSafePaddings();

  const renderControlPanel = (isFS) => {
    return (
      <View style={[styles.controlPanel, { 
        paddingBottom: safePad.pb, 
        paddingLeft: safePad.pl, 
        paddingRight: safePad.pr 
      }]}>
        
        <View style={{ width: 44, alignItems: 'flex-start' }}>
          {isFS ? (
            isPortrait && (
              <Pressable onPress={() => setIsRotated(!isRotated)} style={styles.squareBtn}>
                <Text style={styles.squareBtnIcon}>↻</Text>
              </Pressable>
            )
          ) : (
            <View style={styles.infoCol}>
              <View style={styles.badgeAuto}>
                <Text style={styles.badgeText}>AUTO</Text>
              </View>
              <Text style={styles.hzText}>250 Hz</Text>
            </View>
          )}
        </View>

        <View style={styles.zoomControls}>
          <Pressable 
            style={({ pressed }) => [styles.zoomBtn, pressed && styles.zoomBtnPressed]} 
            onPress={() => handleZoomChange(Math.max(zoomLevel - 100, 50))}
          >
            <Text style={styles.zoomBtnText}>-</Text>
          </Pressable>
          
          <View style={styles.zoomReadout}>
            <Text style={styles.zoomValueText}>{zoomLevel}</Text>
            <Text style={styles.zoomUnitText}>px/s</Text>
          </View>

          <Pressable 
            style={({ pressed }) => [styles.zoomBtn, pressed && styles.zoomBtnPressed]} 
            onPress={() => handleZoomChange(Math.min(zoomLevel + 100, 3000))}
          >
            <Text style={styles.zoomBtnText}>+</Text>
          </Pressable>
        </View>

        <View style={{ width: 44, alignItems: 'flex-end' }}>
          {isFS ? (
            <Pressable onPress={() => { setIsFullscreen(false); setIsRotated(false); }} style={[styles.squareBtn, { backgroundColor: '#e11d48' }]}>
              <Text style={styles.squareBtnIcon}>✕</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => setIsFullscreen(true)} style={styles.squareBtn}>
              <Text style={[styles.squareBtnIcon, { fontSize: 20 }]}>⛶</Text>
            </Pressable>
          )}
        </View>

      </View>
    );
  };

  const renderChart = (W, H) => {
    if (W === 0 || H === 0) return null;
    const CENTER_Y = H / 2;
    const distanceFromCenter = Math.abs(CENTER_Y - chartData.lastY);
    const dynamicGlowRadius = 14 + (distanceFromCenter * 0.15); 

    return (
      <Svg width={W} height={H}>
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
          {renderMedicalGrid(W, H)}
          <Line x1="0" y1={CENTER_Y} x2={W} y2={CENTER_Y} stroke="#3f3f46" strokeWidth="1.5" strokeDasharray="4 4" />
        </G>

        {chartData.pathString !== '' && (
          <G>
            <Path d={chartData.pathString} stroke="rgba(124, 58, 237, 0.05)" strokeWidth="22" fill="none" strokeLinejoin="round" strokeLinecap="round" />
            <Path d={chartData.pathString} stroke="url(#fadeGradient)" strokeWidth="8" fill="none" strokeLinejoin="round" strokeLinecap="round" />
            <Path d={chartData.pathString} stroke="url(#coreGradient)" strokeWidth="2.5" fill="none" strokeLinejoin="round" strokeLinecap="round" />
            <Circle cx={chartData.lastX} cy={chartData.lastY} r={dynamicGlowRadius} fill="rgba(168, 85, 247, 0.2)" />
            <Circle cx={chartData.lastX} cy={chartData.lastY} r="5" fill="rgba(192, 132, 252, 0.8)" />
            <Circle cx={chartData.lastX} cy={chartData.lastY} r="2.5" fill="#f3e8ff" />
          </G>
        )}
      </Svg>
    );
  };

  return (
    <>
      {!isFullscreen && (
        <View style={styles.cardContainer}>
          <View 
            style={{ height: 220, overflow: 'hidden' }}
            onLayout={(e) => setChartSize(e.nativeEvent.layout)}
          >
            {renderChart(chartSize.width, chartSize.height)}
          </View>
          {renderControlPanel(false)}
        </View>
      )}

      <Modal 
        visible={isFullscreen} 
        animationType="fade" 
        transparent={false}
        supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
        onRequestClose={() => setIsFullscreen(false)}
      >
        <View style={styles.modalRoot}>
          <View style={{
            width: isRotated ? Math.max(windowWidth, windowHeight) : '100%',
            height: isRotated ? Math.min(windowWidth, windowHeight) : '100%',
            transform: isRotated ? [{ rotate: '90deg' }] : [],
            backgroundColor: '#050505',
            flexDirection: 'column',
          }}>
            
            <View style={{
              flex: 1, 
              paddingTop: safePad.pt,
              paddingLeft: safePad.pl,
              paddingRight: safePad.pr,
            }}>
              <View 
                style={{ flex: 1, overflow: 'hidden', borderRadius: 8, position: 'relative' }}
                onLayout={(e) => setChartSize(e.nativeEvent.layout)}
              >
                <View style={{ position: 'absolute', top: 12, left: 12, zIndex: 10, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <View style={[styles.badgeAuto, { backgroundColor: 'rgba(39, 39, 42, 0.8)' }]}>
                    <Text style={styles.badgeText}>AUTO</Text>
                  </View>
                  <View style={{ backgroundColor: 'rgba(39, 39, 42, 0.8)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 }}>
                    <Text style={[styles.badgeText, { color: '#d4d4d8' }]}>250 Hz</Text>
                  </View>
                </View>

                {renderChart(chartSize.width, chartSize.height)}
              </View>
            </View>
            
            {renderControlPanel(true)}

          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#050505',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#27272a',
    overflow: 'hidden',
  },
  modalRoot: {
    flex: 1,
    backgroundColor: '#000', 
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlPanel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    backgroundColor: '#09090b',
    borderTopWidth: 1,
    borderColor: '#27272a',
  },
  infoCol: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 4,
  },
  badgeAuto: {
    backgroundColor: '#27272a',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: '#a1a1aa',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  hzText: {
    color: '#71717a',
    fontSize: 10,
    fontWeight: '600',
    paddingLeft: 2,
  },
  zoomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  zoomBtn: {
    backgroundColor: '#27272a',
    width: 36, 
    height: 36, 
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  zoomBtnPressed: {
    backgroundColor: '#3f3f46',
  },
  zoomBtnText: {
    color: '#fff',
    fontWeight: '400',
    fontSize: 20,
    lineHeight: 22,
  },
  zoomReadout: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 50, 
  },
  zoomValueText: {
    color: '#e4e4e7',
    fontSize: 13,
    fontWeight: '700',
  },
  zoomUnitText: {
    color: '#71717a',
    fontSize: 9,
    fontWeight: '500',
  },
  squareBtn: {
    width: 44, 
    height: 44, 
    backgroundColor: '#3f3f46', 
    borderRadius: 8, 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  squareBtnIcon: {
    color: '#fff', 
    fontSize: 18, 
    fontWeight: 'bold',
  }
});

export default LiveEcgChart;
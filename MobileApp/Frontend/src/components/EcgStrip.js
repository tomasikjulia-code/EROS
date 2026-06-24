import React, { useState, useMemo } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, ScrollView, Platform, StatusBar, useWindowDimensions } from 'react-native';
import { Svg, Polyline } from 'react-native-svg';
import { Activity, Clock, Heart } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { styles } from '../constants/Theme';

// Maksymalna liczba punktów w normalnym widoku i fullscreenie
const MAX_POINTS_NORMAL = 400;
const MAX_POINTS_FULL   = 800;

function downsample(arr, maxPts) {
  if (arr.length <= maxPts) return arr;
  const step = arr.length / maxPts;
  const out = new Array(maxPts);
  for (let i = 0; i < maxPts; i++) out[i] = arr[Math.round(i * step)];
  return out;
}

function buildPoints(arr) {
  let minVal = arr[0], maxVal = arr[0];
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] < minVal) minVal = arr[i];
    if (arr[i] > maxVal) maxVal = arr[i];
  }
  const range = (maxVal - minVal) || 1;
  const parts = new Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    parts[i] = `${i},${(190 - ((arr[i] - minVal) / range) * 180).toFixed(1)}`;
  }
  return { points: parts.join(' '), count: arr.length };
}

const EcgStrip = React.memo(({ title, description, time, hr, data }) => {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isPortrait = windowHeight >= windowWidth;

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRotated, setIsRotated] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1); // Mnożnik szerokości (1x do 10x)

  const safeData = useMemo(
    () => (data && data.length > 0 ? data : [0, 0]),
    [data]
  );

  const { points, count } = useMemo(
    () => buildPoints(downsample(safeData, MAX_POINTS_NORMAL)),
    [safeData]
  );

  const { points: pointsFull, count: countFull } = useMemo(
    () => buildPoints(downsample(safeData, MAX_POINTS_FULL)),
    [safeData]
  );

  // Bezpieczne marginesy dla trybu pełnoekranowego
  const getSafePaddings = () => {
    const androidTop = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;
    if (isRotated && isPortrait) {
      return { 
        pt: Math.max(insets.right, 12), 
        pb: Math.max(insets.left, 16), 
        pl: Math.max(insets.top, androidTop, 16), 
        pr: Math.max(insets.bottom, 16) 
      };
    }
    return { 
      pt: Math.max(insets.top, androidTop, 12), 
      pb: Math.max(insets.bottom, 24), 
      pl: Math.max(insets.left, 10), 
      pr: Math.max(insets.right, 10) 
    };
  };
  const safePad = getSafePaddings();

  // Główny render wykresu (współdzielony między normalnym a fullscreenem)
  const renderChart = (isFS, W, H) => {
    const chartWidth = W * (isFS ? zoomLevel : 1);
    const pts = isFS ? pointsFull : points;
    const cnt = isFS ? countFull  : count;

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={isFS}
        bounces={false}
        style={{ flex: 1 }}
      >
        <View style={{ width: chartWidth, height: H }}>
          <Svg viewBox={`0 0 ${cnt} 200`} width="100%" height="100%" preserveAspectRatio="none">
            <Polyline
              points={pts}
              fill="none"
              stroke="#34d399"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
      </ScrollView>
    );
  };

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
           
           <Pressable onPress={() => setIsFullscreen(true)} style={{ backgroundColor: '#27272a', padding: 4, borderRadius: 6, marginLeft: 8 }}>
             <Text style={{ color: '#a1a1aa', fontSize: 10, fontWeight: 'bold' }}>⛶ Pełny ekran</Text>
           </Pressable>
        </View>
      </View>
      
      {/* NORMALNY WIDOK */}
      <View style={[styles.ecgSvgWrapper, { height: 180, width: '100%' }]}>
        {renderChart(false, windowWidth - 32, 180)}
      </View>

      {/* PEŁNY EKRAN (MODAL) */}
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
              <View style={{ flex: 1, overflow: 'hidden', borderRadius: 8, borderWidth: 1, borderColor: '#27272a', backgroundColor: '#09090b', position: 'relative' }}>
                
                {/* Pływające informacje o tętnie na górze wykresu */}
                <View style={{ position: 'absolute', top: 12, left: 12, zIndex: 10, flexDirection: 'row', gap: 8 }}>
                  <View style={[styles.ecgBadgeDark, { backgroundColor: 'rgba(39, 39, 42, 0.8)' }]}><Clock size={12} color="#d4d4d8"/><Text style={styles.ecgBadgeTextDark}>{time}</Text></View>
                  <View style={[styles.ecgBadgeRose, { backgroundColor: 'rgba(251, 113, 133, 0.15)' }]}><Heart size={12} color="#fb7185"/><Text style={styles.ecgBadgeTextRose}>{hr} bpm</Text></View>
                </View>

                {renderChart(true, isRotated ? windowHeight : windowWidth, isRotated ? windowWidth : windowHeight)}
              </View>
            </View>

            {/* PANEL KONTROLNY MODALA - Uporządkowany */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, paddingBottom: safePad.pb, backgroundColor: '#18181b', borderTopWidth: 1, borderColor: '#27272a' }}>
              
              {/* Lewa strona: Obrót (lub puste miejsce dla zachowania symetrii) */}
              <View style={{ width: 44 }}>
                {isPortrait && (
                  <Pressable onPress={() => setIsRotated(!isRotated)} style={localStyles.actionBtn}>
                    <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>↻</Text>
                  </Pressable>
                )}
              </View>

              {/* Środek: Przybliżanie */}
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#27272a', borderRadius: 8, padding: 4 }}>
                <Pressable onPress={() => setZoomLevel(p => Math.max(1, p - 1))} style={localStyles.zoomBtn}>
                  <Text style={localStyles.zoomText}>-</Text>
                </Pressable>
                <Text style={{ color: '#fff', width: 44, textAlign: 'center', fontSize: 14, fontWeight: 'bold' }}>
                  {zoomLevel}x
                </Text>
                <Pressable onPress={() => setZoomLevel(p => Math.min(10, p + 1))} style={localStyles.zoomBtn}>
                  <Text style={localStyles.zoomText}>+</Text>
                </Pressable>
              </View>

              {/* Prawa strona: Zamykanie */}
              <View style={{ width: 44 }}>
                <Pressable onPress={() => { setIsFullscreen(false); setIsRotated(false); setZoomLevel(1); }} style={[localStyles.actionBtn, { backgroundColor: '#e11d48' }]}>
                  <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>✕</Text>
                </Pressable>
              </View>

            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
});

const localStyles = StyleSheet.create({
  zoomBtn: { width: 36, height: 36, backgroundColor: '#3f3f46', justifyContent: 'center', alignItems: 'center', borderRadius: 6 },
  zoomText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  actionBtn: { width: 44, height: 44, backgroundColor: '#3f3f46', borderRadius: 8, justifyContent: 'center', alignItems: 'center' }
});

export default EcgStrip;
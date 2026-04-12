import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Svg, Polyline, Defs, Pattern, Path, Rect } from 'react-native-svg';
import { COLORS } from '../constants/Theme';
import { ecgBuffer } from '../utils/EcgBuffer';

const LiveEcgChart = ({ isMeasuring }) => {
  const [currentFrame, setCurrentFrame] = useState(ecgBuffer.getSnapshot());
  useEffect(() => {
    if (!isMeasuring) return;

    const renderLoop = setInterval(() => {
      // Co 30ms pobieramy to, co aktualnie jest w pamięci RAM bufora
      setCurrentFrame(ecgBuffer.getSnapshot());
    }, 30); 

    return () => clearInterval(renderLoop);
  }, [isMeasuring]);

  // Mapowanie danych z klatki na punkty SVG
  const SCALE = 0.01; 

  // Odejmowanie (110 - ...) odwraca oś Y, żeby dodatnie liczby szły w górę ekranu
  const points = currentFrame.map((val, index) => {
    // Zabezpieczenie przed wartościami null/undefined w buforze
    const safeVal = val || 0; 
    return `${index},${110 - (safeVal * SCALE)}`;
  }).join(' ');

  return (
    <View style={localStyles.ecgSvgWrapper}>
      <Svg viewBox="0 0 150 220" width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <Pattern id="smallGrid" width="5" height="5" patternUnits="userSpaceOnUse">
            <Path d="M 5 0 L 0 0 0 5" fill="none" stroke={COLORS.border} strokeWidth="0.5" />
          </Pattern>
          <Pattern id="largeGrid" width="25" height="25" patternUnits="userSpaceOnUse">
            <Rect width="25" height="25" fill="url(#smallGrid)" />
            <Path d="M 25 0 L 0 0 0 25" fill="none" stroke={COLORS.border} strokeWidth="1" />
          </Pattern>
        </Defs>

        <Rect width="100%" height="100%" fill={COLORS.background} />
        <Rect width="100%" height="100%" fill="url(#largeGrid)" />

        <Polyline 
          points={points} 
          fill="none" 
          stroke={COLORS.accentPurple} // Twój fiolet (lub cokolwiek masz w akcencie)
          strokeWidth="2.5" 
          strokeLinejoin="round" 
        />
      </Svg>
    </View>
  );
};

const localStyles = StyleSheet.create({
  ecgSvgWrapper: {
    height: 220, 
    backgroundColor: COLORS.background, 
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border, 
    marginTop: 12,
    marginBottom: 20,
    overflow: 'hidden',
  }
});

export default LiveEcgChart;
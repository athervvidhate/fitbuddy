import React from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import Svg, { Line, Rect, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

const { width, height } = Dimensions.get('window');

export function BackgroundGlows() {
  const { isDark } = useTheme();
  const horizontalLines = [];
  const verticalLines = [];
  const gridSize = 55;

  // Grid line color adapts to theme: ultra-faint white in dark mode, ultra-faint black in light mode
  const gridStroke = isDark ? 'rgba(255, 255, 255, 0.012)' : 'rgba(0, 0, 0, 0.010)';

  // Generate technical grid pattern for premium athletic texture
  for (let y = 0; y < height; y += gridSize) {
    horizontalLines.push(
      <Line
        key={`h-${y}`}
        x1="0"
        y1={y}
        x2={width}
        y2={y}
        stroke={gridStroke}
        strokeWidth="1"
      />
    );
  }

  for (let x = 0; x < width; x += gridSize) {
    verticalLines.push(
      <Line
        key={`v-${x}`}
        x1={x}
        y1="0"
        x2={x}
        y2={height}
        stroke={gridStroke}
        strokeWidth="1"
      />
    );
  }

  // Define background canvas and gradient opacities based on theme
  const canvasBg = isDark ? '#08080a' : '#fcfcfa';
  
  // Glowing colors
  const amberColor = isDark ? '#d97706' : '#fed7aa'; // Amber glow vs pastel peach
  const orangeColor = isDark ? '#ea580c' : '#ffedd5'; // Volcanic orange vs light cream orange
  const depthColor = isDark ? '#7c2d12' : '#fed7aa';

  // Glow opacities
  const glow1Opacity = isDark ? '0.15' : '0.45';
  const glow1MidOpacity = isDark ? '0.05' : '0.15';
  
  const glow2Opacity = isDark ? '0.12' : '0.40';
  const glow2MidOpacity = isDark ? '0.04' : '0.12';
  
  const glow3Opacity = isDark ? '0.06' : '0.20';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Ambient Canvas Background */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: canvasBg }]} />

      {/* SVG Radial Glows & Grid System */}
      <Svg height="100%" width="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          {/* Top-Right Amber Glow */}
          <RadialGradient
            id="topRightGlow"
            cx="80%"
            cy="10%"
            rx="55%"
            ry="40%"
            fx="80%"
            fy="10%"
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0%" stopColor={amberColor} stopOpacity={glow1Opacity} />
            <Stop offset="50%" stopColor={amberColor} stopOpacity={glow1MidOpacity} />
            <Stop offset="100%" stopColor={canvasBg} stopOpacity="0" />
          </RadialGradient>

          {/* Bottom-Left Volcanic Orange Glow */}
          <RadialGradient
            id="bottomLeftGlow"
            cx="20%"
            cy="90%"
            rx="60%"
            ry="45%"
            fx="20%"
            fy="90%"
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0%" stopColor={orangeColor} stopOpacity={glow2Opacity} />
            <Stop offset="60%" stopColor={orangeColor} stopOpacity={glow2MidOpacity} />
            <Stop offset="100%" stopColor={canvasBg} stopOpacity="0" />
          </RadialGradient>

          {/* Center Subtle Mid-tone Depth */}
          <RadialGradient
            id="centerDepthGlow"
            cx="50%"
            cy="50%"
            rx="50%"
            ry="50%"
            fx="50%"
            fy="50%"
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0%" stopColor={depthColor} stopOpacity={glow3Opacity} />
            <Stop offset="100%" stopColor={canvasBg} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Render Glows as overlapping Rects */}
        <Rect x="0" y="0" width={width} height={height} fill="url(#topRightGlow)" />
        <Rect x="0" y="0" width={width} height={height} fill="url(#bottomLeftGlow)" />
        <Rect x="0" y="0" width={width} height={height} fill="url(#centerDepthGlow)" />

        {/* Technical Grid Overlay */}
        {horizontalLines}
        {verticalLines}
      </Svg>
    </View>
  );
}

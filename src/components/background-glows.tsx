import React from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import Svg, { Line, Rect, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

const { width, height } = Dimensions.get('window');
const GRID_SIZE = 55;

/**
 * This layer is purely decorative and mounted at ~14 sites. Previously every one of them
 * rebuilt ~25 <Line> nodes plus three radial gradients on every render, and all of them are
 * theme consumers — so a single theme toggle reconstructed the whole tree 14 times over.
 *
 * The tree depends on exactly one input: isDark. So both variants are built once, here, and
 * the component just picks one. Rendering allocates nothing, and React skips the subtree
 * entirely when the returned element is referentially identical to last time.
 *
 * Appearance is unchanged. Whether this layer survives at all is decided by design-tokens
 * ticket 05.
 */
function buildLayer(isDark: boolean) {
  // Ultra-faint white in dark mode, ultra-faint black in light mode
  const gridStroke = isDark ? 'rgba(255, 255, 255, 0.012)' : 'rgba(0, 0, 0, 0.010)';
  const canvasBg = isDark ? '#08080a' : '#fcfcfa';

  // Glow colors: saturated in dark mode, pastel in light mode
  const amberColor = isDark ? '#d97706' : '#fed7aa';
  const orangeColor = isDark ? '#ea580c' : '#ffedd5';
  const depthColor = isDark ? '#7c2d12' : '#fed7aa';

  const glow1Opacity = isDark ? '0.15' : '0.45';
  const glow1MidOpacity = isDark ? '0.05' : '0.15';
  const glow2Opacity = isDark ? '0.12' : '0.40';
  const glow2MidOpacity = isDark ? '0.04' : '0.12';
  const glow3Opacity = isDark ? '0.06' : '0.20';

  // Scoped per variant so the two trees can never collide on gradient ids.
  const prefix = isDark ? 'dark' : 'light';

  const lines = [];
  for (let y = 0; y < height; y += GRID_SIZE) {
    lines.push(
      <Line key={`h-${y}`} x1="0" y1={y} x2={width} y2={y} stroke={gridStroke} strokeWidth="1" />
    );
  }
  for (let x = 0; x < width; x += GRID_SIZE) {
    lines.push(
      <Line key={`v-${x}`} x1={x} y1="0" x2={x} y2={height} stroke={gridStroke} strokeWidth="1" />
    );
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Ambient Canvas Background */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: canvasBg }]} />

      {/* SVG Radial Glows & Grid System */}
      <Svg height="100%" width="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          {/* Top-Right Amber Glow */}
          <RadialGradient
            id={`${prefix}TopRightGlow`}
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
            id={`${prefix}BottomLeftGlow`}
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
            id={`${prefix}CenterDepthGlow`}
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
        <Rect x="0" y="0" width={width} height={height} fill={`url(#${prefix}TopRightGlow)`} />
        <Rect x="0" y="0" width={width} height={height} fill={`url(#${prefix}BottomLeftGlow)`} />
        <Rect x="0" y="0" width={width} height={height} fill={`url(#${prefix}CenterDepthGlow)`} />

        {/* Technical Grid Overlay */}
        {lines}
      </Svg>
    </View>
  );
}

const DARK_LAYER = buildLayer(true);
const LIGHT_LAYER = buildLayer(false);

export const BackgroundGlows = React.memo(function BackgroundGlows() {
  const { isDark } = useTheme();
  return isDark ? DARK_LAYER : LIGHT_LAYER;
});

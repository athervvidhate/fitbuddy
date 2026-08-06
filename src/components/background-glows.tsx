import React from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import Svg, { Line, Rect, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import { glow } from '../theme';

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
 * Ticket 05 kept the layer and re-coloured it: the amber/orange gradients fought the violet
 * accent instead of supporting it. Every value below now comes from the `glow` tokens, so this
 * file holds no colors of its own.
 */
function buildLayer(isDark: boolean) {
  const g = glow[isDark ? 'dark' : 'light'];

  const gridStroke = g.grid;
  const canvasBg = g.canvas;

  // Saturated violet in dark mode, pastel violet in light mode.
  const primaryColor = g.primary;
  const secondaryColor = g.secondary;
  const depthColor = g.depth;

  const glow1Opacity = String(g.primaryOpacity);
  const glow1MidOpacity = String(g.primaryMid);
  const glow2Opacity = String(g.secondaryOpacity);
  const glow2MidOpacity = String(g.secondaryMid);
  const glow3Opacity = String(g.depthOpacity);

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
          {/* Top-right primary glow */}
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
            <Stop offset="0%" stopColor={primaryColor} stopOpacity={glow1Opacity} />
            <Stop offset="50%" stopColor={primaryColor} stopOpacity={glow1MidOpacity} />
            <Stop offset="100%" stopColor={canvasBg} stopOpacity="0" />
          </RadialGradient>

          {/* Bottom-left secondary glow */}
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
            <Stop offset="0%" stopColor={secondaryColor} stopOpacity={glow2Opacity} />
            <Stop offset="60%" stopColor={secondaryColor} stopOpacity={glow2MidOpacity} />
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

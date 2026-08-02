/**
 * FitBuddy design tokens — the single source of truth.
 *
 * This file is CommonJS on purpose: `tailwind.config.js` is CJS and must `require()` it, and
 * duplicating values into the Tailwind config is exactly the bug this replaces. Before this,
 * three partial palettes disagreed with each other — `tailwind.config.js` and `ThemeContext`
 * both declared violet `#8b5cf6` as the brand accent while every screen hardcoded orange
 * `#ea580c`, and `src/constants/theme.ts` held a third, unused set.
 *
 * Import from `src/theme` (typed) in app code. Only `tailwind.config.js` requires this directly.
 *
 * Decided in wayfinder ticket 05, from the decisions in ticket 04:
 * Inter · 17px body · no uppercase labels · tabular figures · violet accent.
 */

// ---------------------------------------------------------------------------
// Type scale
//
// A closed set. `text-[9px]`, `text-[10px]` and `text-[11px]` are not in it and must not survive
// the re-skin — 87 of the app's 289 text-size declarations were 10px or smaller. 13px is the
// floor. Only four Inter weights are bundled (400/500/600/700), so every step uses one of them.
// ---------------------------------------------------------------------------
const type = {
  display:    { fontSize: 34, fontWeight: '700', lineHeight: 40, letterSpacing: -0.75 },
  title1:     { fontSize: 28, fontWeight: '700', lineHeight: 34, letterSpacing: -0.56 },
  title2:     { fontSize: 22, fontWeight: '700', lineHeight: 28, letterSpacing: -0.33 },
  heading:    { fontSize: 19, fontWeight: '600', lineHeight: 25, letterSpacing: -0.19 },
  body:       { fontSize: 17, fontWeight: '400', lineHeight: 24, letterSpacing: 0 },
  bodyStrong: { fontSize: 17, fontWeight: '600', lineHeight: 24, letterSpacing: 0 },
  callout:    { fontSize: 15, fontWeight: '400', lineHeight: 21, letterSpacing: 0 },
  label:      { fontSize: 14, fontWeight: '500', lineHeight: 19, letterSpacing: 0 },
  caption:    { fontSize: 13, fontWeight: '500', lineHeight: 17, letterSpacing: 0.07 },

  // Documented exception to the 13px floor. Tab-bar labels are platform chrome, not content, and
  // iOS HIG specifies 10pt there; at 13px "Analytics" truncates to "Analyti...". Use only for the
  // tab bar.
  tabLabel:   { fontSize: 11, fontWeight: '500', lineHeight: 13, letterSpacing: 0 },
};

const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

// ---------------------------------------------------------------------------
// Spacing — 4pt grid. Replaces the unused `Spacing` in src/constants/theme.ts, whose
// half/one/two/three naming did not map to its own values (three === 16).
// ---------------------------------------------------------------------------
const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };

// Radii were inline literals ranging 8–100 across the app; collapsed to six steps.
const radius = { sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, pill: 999 };

// ---------------------------------------------------------------------------
// Color — semantic names only. No component may reference a hex literal.
//
// Neutrals carry a slight violet bias rather than being pure grey, so they read as chosen
// alongside the accent. The accent itself differs per theme: #8b5cf6 is correct on a dark
// ground but drops below comfortable contrast on white, so light mode uses a darker violet.
// ---------------------------------------------------------------------------
const color = {
  dark: {
    bg: '#0b0b0f',
    surface: '#141419',
    surfaceRaised: '#1c1c24',
    border: '#2a2a34',
    borderSoft: '#1f1f27',
    textPrimary: '#f3f2f7',
    textSecondary: '#a3a1b2',
    textTertiary: '#6f6d7e',
    accent: '#8b5cf6',
    accentSoft: 'rgba(139, 92, 246, 0.16)',
    onAccent: '#ffffff',
    success: '#34d399',
    warning: '#fbbf24',
    danger: '#ff6b60',
  },
  light: {
    bg: '#faf9fc',
    surface: '#ffffff',
    surfaceRaised: '#f4f3f8',
    border: '#e4e2ec',
    borderSoft: '#eeedf3',
    textPrimary: '#16161c',
    textSecondary: '#5c5a6b',
    textTertiary: '#8a8898',
    accent: '#7c3aed',
    accentSoft: 'rgba(124, 58, 237, 0.10)',
    onAccent: '#ffffff',
    success: '#059669',
    warning: '#b45309',
    danger: '#dc2626',
  },
};

// ---------------------------------------------------------------------------
// Background glow layer.
//
// Kept rather than deleted, but re-coloured: the previous amber/orange gradients
// (#d97706 / #ea580c / #7c2d12) fought a violet accent instead of supporting it.
// ---------------------------------------------------------------------------
const glow = {
  dark: { canvas: '#0b0b0f', primary: '#8b5cf6', secondary: '#6d28d9', depth: '#4c1d95',
          primaryOpacity: 0.14, primaryMid: 0.05, secondaryOpacity: 0.11, secondaryMid: 0.04,
          depthOpacity: 0.06, grid: 'rgba(255, 255, 255, 0.012)' },
  light: { canvas: '#faf9fc', primary: '#ddd6fe', secondary: '#ede9fe', depth: '#ddd6fe',
           primaryOpacity: 0.5, primaryMid: 0.18, secondaryOpacity: 0.42, secondaryMid: 0.14,
           depthOpacity: 0.22, grid: 'rgba(0, 0, 0, 0.010)' },
};

// Elevation. Shadows need more opacity on a dark ground to read at all.
const elevation = {
  dark: {
    raised:  { shadowColor: '#000', shadowOffset: { width: 0, height: 2 },  shadowOpacity: 0.35, shadowRadius: 8,  elevation: 2 },
    overlay: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.5,  shadowRadius: 28, elevation: 12 },
  },
  light: {
    raised:  { shadowColor: '#0b0b0f', shadowOffset: { width: 0, height: 2 },  shadowOpacity: 0.06, shadowRadius: 8,  elevation: 2 },
    overlay: { shadowColor: '#0b0b0f', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.14, shadowRadius: 28, elevation: 12 },
  },
};

module.exports = { type, fontFamily, spacing, radius, color, glow, elevation };

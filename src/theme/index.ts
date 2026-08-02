/**
 * Typed access to the design tokens.
 *
 * App code imports from here. `tokens.js` stays CommonJS so `tailwind.config.js` can require the
 * same values — one source of truth for both the NativeWind class layer and JS-side consumers
 * (charts, SVG, anything passing colors as props).
 */
import tokens from './tokens.js';

export type ThemeName = 'dark' | 'light';

export type TypeToken =
  | 'display' | 'title1' | 'title2' | 'heading'
  | 'body' | 'bodyStrong' | 'callout' | 'label' | 'caption'
  /** Platform chrome only — see the note in tokens.js. */
  | 'tabLabel';

export type TypeStyle = {
  fontSize: number;
  fontWeight: '400' | '500' | '600' | '700';
  lineHeight: number;
  letterSpacing: number;
};

export type ColorToken =
  | 'bg' | 'surface' | 'surfaceRaised' | 'border' | 'borderSoft'
  | 'textPrimary' | 'textSecondary' | 'textTertiary'
  | 'accent' | 'accentSoft' | 'onAccent'
  | 'success' | 'warning' | 'danger';

export type SpacingToken = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl';
export type RadiusToken = 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'pill';

export const type = tokens.type as Record<TypeToken, TypeStyle>;
export const fontFamily = tokens.fontFamily as Record<
  'regular' | 'medium' | 'semibold' | 'bold',
  string
>;
export const spacing = tokens.spacing as Record<SpacingToken, number>;
export const radius = tokens.radius as Record<RadiusToken, number>;
export const color = tokens.color as Record<ThemeName, Record<ColorToken, string>>;
export const glow = tokens.glow as Record<ThemeName, Record<string, string | number>>;
export const elevation = tokens.elevation as Record<
  ThemeName,
  Record<'raised' | 'overlay', Record<string, any>>
>;

/** Maps a numeric font weight to the matching bundled Inter family name. */
export function familyForWeight(weight: TypeStyle['fontWeight']): string {
  switch (weight) {
    case '700': return fontFamily.bold;
    case '600': return fontFamily.semibold;
    case '500': return fontFamily.medium;
    default: return fontFamily.regular;
  }
}

/**
 * A complete React Native text style for a type token, with the correct Inter face resolved.
 * Bundled static weights mean `fontWeight` alone would not pick the right file.
 */
export function textStyle(token: TypeToken) {
  const t = type[token];
  return {
    fontFamily: familyForWeight(t.fontWeight),
    fontSize: t.fontSize,
    lineHeight: t.lineHeight,
    letterSpacing: t.letterSpacing,
  };
}

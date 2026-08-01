import { useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';
import { color, elevation, glow, radius, spacing, type } from './index';
import type { ColorToken, ThemeName } from './index';

export type ThemeTokens = {
  theme: ThemeName;
  isDark: boolean;
  color: Record<ColorToken, string>;
  elevation: Record<'raised' | 'overlay', Record<string, any>>;
  glow: Record<string, string | number>;
  spacing: typeof spacing;
  radius: typeof radius;
  type: typeof type;
};

/**
 * Per-theme design tokens.
 *
 * Deliberately additive: it reads `isDark` from the existing ThemeContext rather than changing
 * it. Every screen still consumes the legacy `colors` shape (`colors.card`, `colors.textMuted`,
 * …) and will keep working until ticket 07 rewrites them. Changing ThemeContext's shape now would
 * break all of them at once for no benefit.
 */
export function useThemeTokens(): ThemeTokens {
  const { isDark } = useTheme();

  return useMemo(() => {
    const theme: ThemeName = isDark ? 'dark' : 'light';
    return {
      theme,
      isDark,
      color: color[theme],
      elevation: elevation[theme],
      glow: glow[theme],
      spacing,
      radius,
      type,
    };
  }, [isDark]);
}

import React, { useMemo } from 'react';
import { StyleProp, View, ViewProps, ViewStyle } from 'react-native';
import { useThemeTokens } from '../../theme/useThemeTokens';
import type { RadiusToken, SpacingToken } from '../../theme';

export type CardProps = Omit<ViewProps, 'style'> & {
  /** `raised` adds the themed shadow; `flat` is a plain surface. */
  elevation?: 'flat' | 'raised';
  padding?: SpacingToken | 'none';
  radius?: RadiusToken;
  bordered?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Replaces the `themeCard` / `themeBorder` / `themeHeaderBg` className strings that were
 * redeclared at the top of nearly every screen — each screen had its own slightly different
 * copy, which is why surfaces never quite matched between them.
 */
export const Card = React.memo(function Card({
  elevation = 'flat',
  padding = 'lg',
  radius = 'xl',
  bordered = true,
  style,
  ...rest
}: CardProps) {
  const t = useThemeTokens();

  const resolved = useMemo<ViewStyle>(
    () => ({
      backgroundColor: t.color.surface,
      borderRadius: t.radius[radius],
      padding: padding === 'none' ? 0 : t.spacing[padding],
      ...(bordered ? { borderWidth: 1, borderColor: t.color.borderSoft } : null),
      ...(elevation === 'raised' ? t.elevation.raised : null),
    }),
    [elevation, padding, radius, bordered, t]
  );

  return <View {...rest} style={[resolved, style]} />;
});

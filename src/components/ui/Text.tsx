import React, { useMemo } from 'react';
import { Text as RNText, TextProps as RNTextProps, StyleProp, TextStyle } from 'react-native';
import { textStyle } from '../../theme';
import type { ColorToken, TypeToken } from '../../theme';
import { useThemeTokens } from '../../theme/useThemeTokens';

export type TextProps = Omit<RNTextProps, 'style'> & {
  /** A step from the type scale. There is no way to pass a raw font size — that is the point. */
  variant?: TypeToken;
  /** A semantic color token. No component passes a hex literal. */
  color?: ColorToken;
  /** Locks digit widths so numeric columns stop jittering as values change. */
  tabular?: boolean;
  style?: StyleProp<TextStyle>;
};

/**
 * The only text primitive. `variant` resolves size, weight, line-height, letter-spacing *and*
 * the correct bundled Inter face together — setting fontWeight alone would silently fall back,
 * because the app bundles static weights rather than a variable font.
 */
export const Text = React.memo(function Text({
  variant = 'body',
  color = 'textPrimary',
  tabular = false,
  style,
  ...rest
}: TextProps) {
  const t = useThemeTokens();

  const resolved = useMemo<TextStyle>(
    () => ({
      ...textStyle(variant),
      color: t.color[color],
      ...(tabular ? { fontVariant: ['tabular-nums' as const] } : null),
    }),
    [variant, color, tabular, t]
  );

  return <RNText {...rest} style={[resolved, style]} />;
});

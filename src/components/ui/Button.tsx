import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleProp,
  View,
  ViewStyle,
} from 'react-native';
import { Text } from './Text';
import type { ColorToken } from '../../theme';
import { useThemeTokens } from '../../theme/useThemeTokens';
import { usePressed } from './usePressed';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  /** Rendered before the label — an icon, usually. */
  leading?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

const HEIGHT: Record<ButtonSize, number> = { sm: 36, md: 44, lg: 52 };
const PAD_X: Record<ButtonSize, number> = { sm: 14, md: 18, lg: 22 };

/**
 * Replaces the bespoke TouchableOpacity-with-inline-styles that every screen hand-rolled.
 * 44pt is the minimum hit target on iOS, which is why `md` is the default rather than `sm`.
 */
export const Button = React.memo(function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  leading,
  disabled,
  style,
  onPressIn,
  onPressOut,
  ...rest
}: ButtonProps) {
  const t = useThemeTokens();
  const isDisabled = disabled || loading;
  const press = usePressed(onPressIn, onPressOut);

  const { container, labelColor } = useMemo(() => {
    const base: ViewStyle = {
      height: HEIGHT[size],
      paddingHorizontal: PAD_X[size],
      borderRadius: t.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: t.spacing.sm,
      alignSelf: fullWidth ? 'stretch' : 'flex-start',
      flexGrow: fullWidth ? 1 : 0,
    };

    switch (variant) {
      case 'primary':
        return {
          container: { ...base, backgroundColor: t.color.accent },
          labelColor: 'onAccent' as ColorToken,
        };
      case 'destructive':
        return {
          container: { ...base, backgroundColor: t.color.danger },
          labelColor: 'onAccent' as ColorToken,
        };
      case 'secondary':
        return {
          container: {
            ...base,
            backgroundColor: t.color.surfaceRaised,
            borderWidth: 1,
            borderColor: t.color.border,
          },
          labelColor: 'textPrimary' as ColorToken,
        };
      default:
        return {
          container: { ...base, backgroundColor: 'transparent' },
          labelColor: 'accent' as ColorToken,
        };
    }
  }, [variant, size, fullWidth, t]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      // Plain array, never the `({ pressed }) => …` form — see usePressed.
      style={[container, press.pressed && { opacity: 0.75 }, isDisabled && { opacity: 0.45 }, style]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator size="small" color={t.color[labelColor]} />
      ) : (
        <>
          {leading ? <View>{leading}</View> : null}
          <Text variant={size === 'sm' ? 'label' : 'bodyStrong'} color={labelColor}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
});

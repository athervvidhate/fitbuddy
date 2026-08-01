import React, { useMemo, useState } from 'react';
import {
  StyleProp,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { Text } from './Text';
import { textStyle } from '../../theme';
import { useThemeTokens } from '../../theme/useThemeTokens';

export type InputProps = Omit<TextInputProps, 'style'> & {
  label?: string;
  /** Renders the field in an error state and shows the message beneath it. */
  error?: string;
  /** Locks digit widths. Set automatically by NumericInput. */
  tabular?: boolean;
  align?: TextStyle['textAlign'];
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
};

export const Input = React.memo(function Input({
  label,
  error,
  tabular = false,
  align = 'left',
  style,
  containerStyle,
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const t = useThemeTokens();
  const [focused, setFocused] = useState(false);

  const borderColor = error ? t.color.danger : focused ? t.color.accent : t.color.border;

  const field = useMemo<TextStyle>(
    () => ({
      ...textStyle('body'),
      color: t.color.textPrimary,
      backgroundColor: t.color.surfaceRaised,
      borderWidth: 1,
      borderRadius: t.radius.md,
      paddingHorizontal: t.spacing.md,
      height: 48,
      textAlign: align,
      ...(tabular ? { fontVariant: ['tabular-nums' as const] } : null),
    }),
    [t, align, tabular]
  );

  return (
    <View style={containerStyle}>
      {label ? (
        <Text variant="label" color="textSecondary" style={{ marginBottom: t.spacing.xs }}>
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={t.color.textTertiary}
        selectionColor={t.color.accent}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[field, { borderColor }, style]}
      />
      {error ? (
        <Text variant="caption" color="danger" style={{ marginTop: t.spacing.xs }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
});

/**
 * The weight/reps field. Always tabular and centred, because these render in columns where a
 * shifting digit width is exactly the jitter the type decision set out to remove.
 */
export const NumericInput = React.memo(function NumericInput(props: InputProps) {
  return <Input keyboardType="numeric" selectTextOnFocus align="center" tabular {...props} />;
});

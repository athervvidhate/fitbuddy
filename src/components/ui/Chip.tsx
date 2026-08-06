import React, { useMemo } from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import { Text } from './Text';
import { useThemeTokens } from '../../theme/useThemeTokens';
import { usePressed } from './usePressed';

export type ChipProps = Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * The category / exercise-type selector, previously duplicated between ActiveWorkoutLogger.tsx
 * and routines.tsx with different padding and colors in each.
 */
export const Chip = React.memo(function Chip({
  label,
  selected = false,
  style,
  onPressIn,
  onPressOut,
  ...rest
}: ChipProps) {
  const t = useThemeTokens();
  const press = usePressed(onPressIn, onPressOut);

  const container = useMemo<ViewStyle>(
    () => ({
      paddingHorizontal: t.spacing.lg,
      paddingVertical: t.spacing.sm,
      borderRadius: t.radius.pill,
      borderWidth: 1,
      backgroundColor: selected ? t.color.accent : t.color.surface,
      borderColor: selected ? t.color.accent : t.color.border,
    }),
    [selected, t]
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      // Plain array, never the `({ pressed }) => …` form — see usePressed.
      style={[container, press.pressed && { opacity: 0.75 }, style]}
      {...rest}
    >
      <Text variant="label" color={selected ? 'onAccent' : 'textSecondary'}>
        {label}
      </Text>
    </Pressable>
  );
});

import React, { useMemo } from 'react';
import { ScrollView, ScrollViewProps, StyleProp, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeTokens } from '../../theme/useThemeTokens';

/** Floating tab bar geometry, from src/app/(tabs)/_layout.tsx. */
const TAB_BAR_HEIGHT = 62;
const TAB_BAR_GAP = 16;

export type ScreenProps = {
  children: React.ReactNode;
  /** Wraps content in a ScrollView. Off for screens that own their own list. */
  scroll?: boolean;
  /** Adds bottom padding to clear the floating tab bar. Off for modals and auth screens. */
  tabBarInset?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
} & Pick<ScrollViewProps, 'refreshControl' | 'onScroll' | 'scrollEventThrottle' | 'testID'>;

/**
 * The standard page shell: themed background, safe-area handling, and the tab-bar bottom inset
 * that was previously recomputed inline in several files (`bottomInset > 0 ? bottomInset : 16`,
 * repeated with small variations that did not agree).
 */
export const Screen = React.memo(function Screen({
  children,
  scroll = true,
  tabBarInset = true,
  padded = true,
  style,
  contentContainerStyle,
  ...scrollProps
}: ScreenProps) {
  const t = useThemeTokens();
  const insets = useSafeAreaInsets();

  const bottomPad = useMemo(() => {
    if (!tabBarInset) return t.spacing.xl;
    const floating = insets.bottom > 0 ? insets.bottom : TAB_BAR_GAP;
    return floating + TAB_BAR_HEIGHT + t.spacing.xl;
  }, [tabBarInset, insets.bottom, t]);

  const content = useMemo<ViewStyle>(
    () => ({
      paddingTop: insets.top,
      paddingHorizontal: padded ? t.spacing.lg : 0,
      paddingBottom: bottomPad,
    }),
    [insets.top, padded, bottomPad, t]
  );

  if (!scroll) {
    return (
      <View style={[{ flex: 1, backgroundColor: t.color.bg }, content, style]}>{children}</View>
    );
  }

  return (
    <ScrollView
      style={[{ flex: 1, backgroundColor: t.color.bg }, style]}
      contentContainerStyle={[content, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      {...scrollProps}
    >
      {children}
    </ScrollView>
  );
});

import React, { useMemo } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { BackgroundGlows } from '../background-glows';
import { Screen, Text } from '../ui';
import { usePressed } from '../ui/usePressed';
import { useThemeTokens } from '../../theme/useThemeTokens';

export type AuthShellProps = {
  title: string;
  subtitle: string;
  /** The form card. */
  children: React.ReactNode;
  /** The cross-link to the other auth screen. */
  footer: React.ReactNode;
};

/**
 * The page chrome shared by login and signup: glow layer, keyboard avoidance, brand mark, and a
 * vertically centred column. Both screens were previously byte-identical here apart from their
 * copy, and drifted anyway.
 *
 * These are the only screens outside the tab shell, so `tabBarInset` is off — there is no
 * floating tab bar to clear.
 */
export const AuthShell = React.memo(function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: AuthShellProps) {
  const t = useThemeTokens();

  // Overrides Screen's horizontal padding rather than adding to it — auth is a single centred
  // column and wants more breathing room than a list screen.
  const content = useMemo(
    () => ({
      flexGrow: 1,
      justifyContent: 'center' as const,
      paddingHorizontal: t.spacing.xl,
    }),
    [t]
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.color.bg }}>
      <BackgroundGlows />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Screen tabBarInset={false} padded={false} contentContainerStyle={content}>
          <View style={{ alignItems: 'center', marginBottom: t.spacing.xl }}>
            <View
              style={{
                borderWidth: 1,
                borderColor: t.color.border,
                backgroundColor: t.color.surfaceRaised,
                borderRadius: t.radius.pill,
                paddingHorizontal: t.spacing.md,
                paddingVertical: t.spacing.xs,
                marginBottom: t.spacing.lg,
              }}
            >
              <Text variant="caption" color="accent">
                FitBuddy
              </Text>
            </View>

            <Text variant="title1">{title}</Text>
            <Text
              variant="callout"
              color="textSecondary"
              style={{ marginTop: t.spacing.sm, textAlign: 'center', maxWidth: 320 }}
            >
              {subtitle}
            </Text>
          </View>

          {children}

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: t.spacing.xl,
            }}
          >
            {footer}
          </View>
        </Screen>
      </KeyboardAvoidingView>
    </View>
  );
});

export type AuthLinkProps = {
  /** The lead-in, e.g. "Don't have an account?" */
  prompt: string;
  label: string;
  onPress: () => void;
};

/** The cross-link between login and signup. */
export const AuthLink = React.memo(function AuthLink({ prompt, label, onPress }: AuthLinkProps) {
  const press = usePressed();

  return (
    <>
      <Text variant="callout" color="textSecondary">
        {prompt}{' '}
      </Text>
      <Pressable
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="link"
        // Plain array, never the `({ pressed }) => …` form — see usePressed.
        style={[press.pressed ? { opacity: 0.6 } : null]}
      >
        <Text variant="callout" color="accent">
          {label}
        </Text>
      </Pressable>
    </>
  );
});

export type FormMessageProps = {
  tone: 'danger' | 'success';
  message: string;
};

/**
 * A form-level result: a server error, or the "check your email" confirmation. Field-level
 * problems belong on the field, via `Input`'s `error` prop — not here.
 */
export const FormMessage = React.memo(function FormMessage({ tone, message }: FormMessageProps) {
  const t = useThemeTokens();

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: t.color[tone],
        backgroundColor: t.color.surfaceRaised,
        borderRadius: t.radius.md,
        padding: t.spacing.md,
        marginBottom: t.spacing.lg,
      }}
    >
      <Text variant="callout" color={tone}>
        {message}
      </Text>
    </View>
  );
});

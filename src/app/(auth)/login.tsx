import React, { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { AuthLink, AuthShell, FormMessage } from '../../components/auth/AuthShell';
import { Button, Card, Input } from '../../components/ui';
import { useThemeTokens } from '../../theme/useThemeTokens';

type Errors = {
  email?: string;
  password?: string;
  /** A server-side failure, which is about the credential pair rather than one field. */
  form?: string;
};

export default function LoginScreen() {
  const router = useRouter();
  const t = useThemeTokens();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const handleLogin = useCallback(async () => {
    const next: Errors = {};
    if (!email.trim()) next.email = 'Enter your email address.';
    if (!password) next.password = 'Enter your password.';
    if (next.email || next.password) {
      setErrors(next);
      return;
    }

    setLoading(true);
    setErrors({});
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) setErrors({ form: error.message });
    } catch (e) {
      setErrors({ form: 'Connection failed. Please try again.' });
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [email, password]);

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Track your workouts, plan your routines, and view your progress."
      footer={
        <AuthLink
          prompt="Don't have an account?"
          label="Sign up"
          onPress={() => router.push('/signup')}
        />
      }
    >
      <Card padding="xl" radius="xxl" elevation="raised">
        {errors.form ? <FormMessage tone="danger" message={errors.form} /> : null}

        <Input
          label="Email address"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="next"
          containerStyle={{ marginBottom: t.spacing.lg }}
        />

        <Input
          label="Password"
          placeholder="Enter your password"
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          secureTextEntry
          autoCapitalize="none"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={handleLogin}
          containerStyle={{ marginBottom: t.spacing.xl }}
        />

        <Button label="Log in" size="lg" fullWidth loading={loading} onPress={handleLogin} />
      </Card>
    </AuthShell>
  );
}

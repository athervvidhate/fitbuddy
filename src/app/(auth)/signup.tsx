import React, { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { AuthLink, AuthShell, FormMessage } from '../../components/auth/AuthShell';
import { Button, Card, Input } from '../../components/ui';
import { useThemeTokens } from '../../theme/useThemeTokens';

const MIN_PASSWORD_LENGTH = 6;

type Errors = {
  username?: string;
  email?: string;
  password?: string;
  confirm?: string;
  /** A server-side failure, which is not attributable to a single field. */
  form?: string;
};

export default function SignupScreen() {
  const router = useRouter();
  const t = useThemeTokens();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSignup = useCallback(async () => {
    const next: Errors = {};
    if (!username.trim()) next.username = 'Choose a username.';
    if (!email.trim()) next.email = 'Enter your email address.';
    if (!password) {
      next.password = 'Choose a password.';
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      next.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    if (!confirmPassword) {
      next.confirm = 'Confirm your password.';
    } else if (password && password !== confirmPassword) {
      next.confirm = 'Passwords do not match.';
    }

    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }

    setLoading(true);
    setErrors({});
    setSuccessMsg(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { username: username.trim().toLowerCase() } },
      });

      if (error) {
        setErrors({ form: error.message });
      } else if (data.session) {
        setSuccessMsg('Account created. Signing you in…');
      } else {
        setSuccessMsg('Account created. Check your email for the verification link.');
        setUsername('');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
      }
    } catch (e) {
      setErrors({ form: 'Connection failed. Please try again.' });
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [username, email, password, confirmPassword]);

  return (
    <AuthShell
      title="Create account"
      subtitle="Sign up to start tracking workouts, building routines, and viewing your progress."
      footer={
        <AuthLink
          prompt="Already have an account?"
          label="Log in"
          onPress={() => router.push('/login')}
        />
      }
    >
      <Card padding="xl" radius="xxl" elevation="raised">
        {errors.form ? <FormMessage tone="danger" message={errors.form} /> : null}
        {successMsg ? <FormMessage tone="success" message={successMsg} /> : null}

        <Input
          label="Username"
          placeholder="Choose a username"
          value={username}
          onChangeText={setUsername}
          error={errors.username}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="username"
          returnKeyType="next"
          containerStyle={{ marginBottom: t.spacing.lg }}
        />

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
          placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          secureTextEntry
          autoCapitalize="none"
          textContentType="newPassword"
          returnKeyType="next"
          containerStyle={{ marginBottom: t.spacing.lg }}
        />

        <Input
          label="Confirm password"
          placeholder="Re-enter your password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          error={errors.confirm}
          secureTextEntry
          autoCapitalize="none"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={handleSignup}
          containerStyle={{ marginBottom: t.spacing.xl }}
        />

        <Button label="Sign up" size="lg" fullWidth loading={loading} onPress={handleSignup} />
      </Card>
    </AuthShell>
  );
}

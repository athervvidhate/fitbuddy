import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { BackgroundGlows } from '../../components/background-glows';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

export default function SignupScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<'username' | 'email' | 'password' | 'confirm' | null>(null);

  const scale = useSharedValue(1);
  const btnAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleSignup = async () => {
    if (!email || !username || !password || !confirmPassword) {
      setErrorMsg('All fields are required.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Password confirmation does not match.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password is too short (minimum 6 characters).');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            username: username.trim().toLowerCase(),
          },
        },
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        if (data.session) {
          setSuccessMsg('Registration successful. Logging in...');
        } else {
          setSuccessMsg('Success. Please check your email for the verification link.');
          setEmail('');
          setUsername('');
          setPassword('');
          setConfirmPassword('');
        }
      }
    } catch (e: any) {
      setErrorMsg('Connection failed. Please try again.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-[#08080a]"
      style={{ backgroundColor: '#08080a' }}
    >
      <BackgroundGlows />
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 24 }}>
        <View className="items-center mb-8">
          {/* Glowing Brand Tag */}
          <View
            className="border border-white/10 bg-zinc-900/50 px-4 py-1.5 mb-5"
            style={{ borderRadius: 100 }}
          >
            <Text
              className="text-[10px] font-bold text-[#ea580c] tracking-wide"
              style={{ fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }}
            >
              FitBuddy
            </Text>
          </View>

          <Text
            className="text-2xl font-bold tracking-wide text-[#e2e2e5]"
            style={{ fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }}
          >
            Create Account
          </Text>
          <Text
            className="text-[11px] tracking-wide mt-2 text-center max-w-[290px] leading-relaxed text-zinc-500 font-medium"
            style={{ fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }}
          >
            Sign up to start tracking your workouts, building routines, and viewing analytics.
          </Text>
        </View>

        {/* Velvet Glass Card */}
        <View
          className="bg-zinc-950/70 border border-white/10 p-6"
          style={{
            borderRadius: 24,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.4,
            shadowRadius: 24,
            elevation: 8,
          }}
        >
          <Text
            className="text-[10px] font-bold text-zinc-400 mb-6 tracking-wide"
            style={{ fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }}
          >
            Sign Up
          </Text>

          {errorMsg && (
            <View
              className="border border-[#ff3b30]/30 bg-[#ff3b30]/5 p-3.5 mb-5"
              style={{ borderRadius: 12 }}
            >
              <Text
                className="text-[#ff453a] text-[10px] font-bold uppercase tracking-wide leading-normal"
                style={{ fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }}
              >
                {errorMsg}
              </Text>
            </View>
          )}

          {successMsg && (
            <View
              className="border border-[#30d158]/30 bg-[#30d158]/5 p-3.5 mb-5"
              style={{ borderRadius: 12 }}
            >
              <Text
                className="text-[#30d158] text-[10px] font-bold uppercase tracking-wide leading-normal"
                style={{ fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }}
              >
                {successMsg}
              </Text>
            </View>
          )}

          {/* Username Input */}
          <Text
            className="text-[9px] font-bold text-zinc-500 tracking-wide mb-2"
            style={{ fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }}
          >
            Username
          </Text>
          <View
            className="flex-row items-center bg-zinc-900/40 border px-4 py-3 mb-4"
            style={{
              borderRadius: 14,
              borderColor: focusedField === 'username' ? '#ea580c' : 'rgba(255, 255, 255, 0.08)',
            }}
          >
            <TextInput
              className="flex-1 text-sm h-6 text-[#e2e2e5]"
              style={{ color: '#e2e2e5' }}
              placeholder="Choose a username"
              placeholderTextColor="#5c5c61"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              onFocus={() => setFocusedField('username')}
              onBlur={() => setFocusedField(null)}
            />
          </View>

          {/* Email Input */}
          <Text
            className="text-[9px] font-bold text-zinc-500 tracking-wide mb-2"
            style={{ fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }}
          >
            Email Address
          </Text>
          <View
            className="flex-row items-center bg-zinc-900/40 border px-4 py-3 mb-4"
            style={{
              borderRadius: 14,
              borderColor: focusedField === 'email' ? '#ea580c' : 'rgba(255, 255, 255, 0.08)',
            }}
          >
            <TextInput
              className="flex-1 text-sm h-6 text-[#e2e2e5]"
              style={{ color: '#e2e2e5' }}
              placeholder="Enter email address"
              placeholderTextColor="#5c5c61"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
            />
          </View>

          {/* Password Input */}
          <Text
            className="text-[9px] font-bold text-zinc-500 tracking-wide mb-2"
            style={{ fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }}
          >
            Password
          </Text>
          <View
            className="flex-row items-center bg-zinc-900/40 border px-4 py-3 mb-4"
            style={{
              borderRadius: 14,
              borderColor: focusedField === 'password' ? '#ea580c' : 'rgba(255, 255, 255, 0.08)',
            }}
          >
            <TextInput
              className="flex-1 text-sm h-6 text-[#e2e2e5]"
              style={{ color: '#e2e2e5' }}
              placeholder="Minimum 6 characters"
              placeholderTextColor="#5c5c61"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
            />
          </View>

          {/* Confirm Password Input */}
          <Text
            className="text-[9px] font-bold text-zinc-500 tracking-wide mb-2"
            style={{ fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }}
          >
            Confirm Password
          </Text>
          <View
            className="flex-row items-center bg-zinc-900/40 border px-4 py-3 mb-6"
            style={{
              borderRadius: 14,
              borderColor: focusedField === 'confirm' ? '#ea580c' : 'rgba(255, 255, 255, 0.08)',
            }}
          >
            <TextInput
              className="flex-1 text-sm h-6 text-[#e2e2e5]"
              style={{ color: '#e2e2e5' }}
              placeholder="Confirm your password"
              placeholderTextColor="#5c5c61"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              onFocus={() => setFocusedField('confirm')}
              onBlur={() => setFocusedField(null)}
            />
          </View>

          {/* Spring-Active Volcanic Orange Button */}
          <Pressable
            onPress={handleSignup}
            disabled={loading}
            onPressIn={() => { scale.value = withSpring(0.96, { damping: 15, stiffness: 150 }); }}
            onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 150 }); }}
          >
            <Animated.View
              style={[
                btnAnimatedStyle,
                {
                  backgroundColor: '#ea580c',
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                },
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text
                  className="text-white font-bold text-xs tracking-wide"
                  style={{ fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }}
                >
                  Sign Up
                </Text>
              )}
            </Animated.View>
          </Pressable>
        </View>

        {/* Footer Link */}
        <View className="flex-row justify-center mt-8 mb-8">
          <Text
            className="text-zinc-600 text-xs font-medium"
            style={{ fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }}
          >
            Already have an account?{' '}
          </Text>
          <TouchableOpacity onPress={() => router.push('/login')}>
            <Text
              className="text-[#ea580c] font-bold text-xs tracking-wide"
              style={{ fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }}
            >
              Log in here
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

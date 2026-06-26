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

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);

  const scale = useSharedValue(1);
  const btnAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleLogin = async () => {
    if (!email || !password) {
      setErrorMsg('All authentication fields are required.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        setErrorMsg(error.message);
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
            Welcome Back
          </Text>
          <Text
            className="text-[11px] tracking-wide mt-2 text-center max-w-[290px] leading-relaxed text-zinc-500 font-medium"
            style={{ fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }}
          >
            Track your workouts, plan your routines, and view your progress.
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
            Log In
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
              textContentType="emailAddress"
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
            className="flex-row items-center bg-zinc-900/40 border px-4 py-3 mb-6"
            style={{
              borderRadius: 14,
              borderColor: focusedField === 'password' ? '#ea580c' : 'rgba(255, 255, 255, 0.08)',
            }}
          >
            <TextInput
              className="flex-1 text-sm h-6 text-[#e2e2e5]"
              style={{ color: '#e2e2e5' }}
              placeholder="Enter your password"
              placeholderTextColor="#5c5c61"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              textContentType="password"
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
            />
          </View>

          {/* Spring-Active Volcanic Orange Button */}
          <Pressable
            onPress={handleLogin}
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
                  Log In
                </Text>
              )}
            </Animated.View>
          </Pressable>
        </View>

        {/* Footer Link */}
        <View className="flex-row justify-center mt-8">
          <Text
            className="text-zinc-600 text-xs font-medium"
            style={{ fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }}
          >
            Don't have an account?{' '}
          </Text>
          <TouchableOpacity onPress={() => router.push('/signup')}>
            <Text
              className="text-[#ea580c] font-bold text-xs tracking-wide"
              style={{ fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }}
            >
              Sign up here
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

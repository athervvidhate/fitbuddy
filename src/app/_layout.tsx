import React, { useEffect } from 'react';
import { View, ActivityIndicator, Text, Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import '../global.css';

import { AuthProvider, useAuth } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { UnitProvider } from '../context/UnitContext';
import { WorkoutProvider } from '../context/WorkoutContext';
import { BackgroundGlows } from '../components/background-glows';

function RootLayoutContent() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user) {
      // If not logged in and not already in (auth) screens, redirect to login
      if (!inAuthGroup) {
        router.replace('/login');
      }
    } else {
      // If logged in and in (auth) screens, redirect to dashboard (tabs)
      if (inAuthGroup || (segments as any).length === 0 || (segments as any)[0] === '') {
        router.replace('/(tabs)');
      }
    }
  }, [user, isLoading, segments]);

  return (
    <View style={{ flex: 1, backgroundColor: '#08080a' }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      {isLoading && (
        <View className="absolute inset-0 bg-[#08080a] justify-center items-center z-50">
          <BackgroundGlows />
          <View 
            className="items-center p-8 bg-zinc-950/70 border border-white/10" 
            style={{ 
              borderRadius: 24,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.4,
              shadowRadius: 24,
              elevation: 8
            }}
          >
            <Text 
              className="text-[14px] font-bold text-[#ea580c] tracking-wide mb-2"
              style={{ fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }}
            >
              FitBuddy
            </Text>
            <Text 
              className="text-[10px] text-zinc-400 tracking-[0.05em] mb-5"
              style={{ fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }}
            >
              Loading your fitness workspace...
            </Text>
            <ActivityIndicator size="small" color="#ea580c" />
          </View>
        </View>
      )}
    </View>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <UnitProvider>
          <WorkoutProvider>
            <RootLayoutContent />
          </WorkoutProvider>
        </UnitProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

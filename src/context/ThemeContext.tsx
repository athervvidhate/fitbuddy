import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colorScheme } from 'nativewind';

type ThemeColors = {
  dark: string;
  card: string;
  border: string;
  accent: string;
  success: string;
  warning: string;
  text: string;
  textMuted: string;
};

type ThemeContextType = {
  isDark: boolean;
  toggleTheme: () => void;
  colors: ThemeColors;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@fitbuddy_theme';

// Both palettes are built once at module scope so `colors` is referentially stable per theme.
// Consumers that only read colors never see a new object identity unless the theme actually flips.
const darkColors: ThemeColors = {
  dark: '#050505',
  card: '#0d0d11',
  border: '#1f1f23',
  accent: '#8b5cf6',   // Neon Violet
  success: '#10b981',  // Emerald Green
  warning: '#f59e0b',  // Amber
  text: '#f4f4f5',
  textMuted: '#8e8e93',
};

const lightColors: ThemeColors = {
  dark: '#fcfcfa',
  card: '#ffffff',
  border: '#e4e4e7',
  accent: '#8b5cf6',
  success: '#10b981',
  warning: '#f59e0b',
  text: '#18181b',
  textMuted: '#71717a',
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Default to dark mode for premium look
  const [isDark, setIsDark] = useState(true);

  // Lets toggleTheme keep a stable identity without reading stale state.
  const isDarkRef = useRef(isDark);
  isDarkRef.current = isDark;

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        const nextIsDark = savedTheme === 'light' ? false : true;
        colorScheme.set(nextIsDark ? 'dark' : 'light');
        setIsDark(nextIsDark);
      } catch (e) {
        console.error('Failed to load theme preference', e);
        colorScheme.set('dark');
      }
    };
    loadTheme();
  }, []);

  const toggleTheme = useCallback(() => {
    const next = !isDarkRef.current;
    // colorScheme.set is NativeWind's imperative API. Deliberately not useColorScheme():
    // that hook subscribes the provider to scheme changes, which made every toggle render
    // the provider twice and cascade to all consumers twice.
    colorScheme.set(next ? 'dark' : 'light');
    setIsDark(next);
    AsyncStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light').catch((e) =>
      console.error('Failed to save theme preference', e)
    );
  }, []);

  const colors = isDark ? darkColors : lightColors;

  const value = useMemo(
    () => ({ isDark, toggleTheme, colors }),
    [isDark, toggleTheme, colors]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'nativewind';

type ThemeContextType = {
  isDark: boolean;
  toggleTheme: () => void;
  colors: {
    dark: string;
    card: string;
    border: string;
    accent: string;
    success: string;
    warning: string;
    text: string;
    textMuted: string;
  };
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@fitbuddy_theme';

// Hardcoded premium values for Javascript-rendered components (like Charts)
const brandColors = {
  dark: '#050505',
  card: '#0d0d11',
  border: '#1f1f23',
  accent: '#8b5cf6',   // Neon Violet
  success: '#10b981',  // Emerald Green
  warning: '#f59e0b',  // Amber
  textDark: '#f4f4f5',  // Light gray for dark mode
  textLight: '#18181b', // Dark gray for light mode
  textMutedDark: '#8e8e93',
  textMutedLight: '#71717a',
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { colorScheme, setColorScheme } = useColorScheme();
  const [isDark, setIsDark] = useState(true); // Default to dark mode for premium look

  useEffect(() => {
    // Load persisted theme
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedTheme === 'dark' || savedTheme === 'light') {
          setColorScheme(savedTheme);
          setIsDark(savedTheme === 'dark');
        } else {
          // Default to dark mode for premium look
          setColorScheme('dark');
          setIsDark(true);
        }
      } catch (e) {
        console.error('Failed to load theme preference', e);
      }
    };
    loadTheme();
  }, []);

  const toggleTheme = async () => {
    const nextTheme = isDark ? 'light' : 'dark';
    try {
      setColorScheme(nextTheme);
      setIsDark(!isDark);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch (e) {
      console.error('Failed to save theme preference', e);
    }
  };

  const themeColors = {
    dark: isDark ? brandColors.dark : '#fcfcfa',
    card: isDark ? brandColors.card : '#ffffff',
    border: isDark ? brandColors.border : '#e4e4e7',
    accent: brandColors.accent,
    success: brandColors.success,
    warning: brandColors.warning,
    text: isDark ? brandColors.textDark : brandColors.textLight,
    textMuted: isDark ? brandColors.textMutedDark : brandColors.textMutedLight,
  };

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, colors: themeColors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

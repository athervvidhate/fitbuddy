import React from 'react';
import { View, Text, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Dumbbell, Users, TrendingUp, Settings } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { ActiveWorkoutLogger } from '../../components/ActiveWorkoutLogger';

interface TabIconProps {
  IconComponent: any;
  color: any;
  focused: boolean;
}

function TabIcon({ IconComponent, color, focused }: TabIconProps) {
  return (
    <View className="items-center justify-center" style={{ height: '100%', paddingTop: 4 }}>
      <IconComponent 
        color={color} 
        size={22} 
        strokeWidth={focused ? 2.0 : 1.5} 
      />
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom;
  const { colors, isDark } = useTheme();
  
  // Clean floating position above the home indicator
  const floatingBottom = bottomInset > 0 ? bottomInset : 16;

  const systemFont = Platform.OS === 'ios' ? 'System' : 'sans-serif';

  return (
    <View style={{ flex: 1, backgroundColor: colors.dark }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#ea580c', // Volcanic Orange
          tabBarInactiveTintColor: isDark ? '#5c5c61' : '#8e8e93', // Muted Slate
          tabBarStyle: {
            backgroundColor: isDark ? 'rgba(15, 15, 20, 0.82)' : 'rgba(255, 255, 255, 0.90)',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
            position: 'absolute',
            bottom: floatingBottom,
            left: 16,
            right: 16,
            height: 62,
            borderRadius: 28,
            paddingBottom: 0,
            borderTopWidth: 1,
            borderTopColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
            // Premium ambient shadows to separate the floating bar
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: isDark ? 0.45 : 0.12,
            shadowRadius: 20,
            elevation: 10,
          },
          tabBarLabelStyle: {
            fontFamily: systemFont,
            fontSize: 10,
            fontWeight: '600',
            textTransform: 'none',
            letterSpacing: 0.2,
            marginTop: 2,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon IconComponent={Home} color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="routines"
          options={{
            title: 'Routines',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon IconComponent={Dumbbell} color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="social"
          options={{
            title: 'Feed',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon IconComponent={Users} color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="analytics"
          options={{
            title: 'Analytics',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon IconComponent={TrendingUp} color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon IconComponent={Settings} color={color} focused={focused} />
            ),
          }}
        />
      </Tabs>
      <ActiveWorkoutLogger />
    </View>
  );
}

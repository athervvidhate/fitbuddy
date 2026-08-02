import React from 'react';
import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Dumbbell, TrendingUp, Settings } from 'lucide-react-native';
import { ActiveWorkoutLogger } from '../../components/ActiveWorkoutLogger';
import { fontFamily, type as typeScale } from '../../theme';
import { useThemeTokens } from '../../theme/useThemeTokens';

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
  const t = useThemeTokens();

  // Clean floating position above the home indicator
  const floatingBottom = insets.bottom > 0 ? insets.bottom : t.spacing.lg;

  return (
    <View style={{ flex: 1, backgroundColor: t.color.bg }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: t.color.accent,
          tabBarInactiveTintColor: t.color.textTertiary,
          tabBarStyle: {
            backgroundColor: t.color.surface,
            borderWidth: 1,
            borderColor: t.color.border,
            position: 'absolute',
            bottom: floatingBottom,
            left: t.spacing.lg,
            right: t.spacing.lg,
            height: 62,
            borderRadius: t.radius.xxl,
            paddingBottom: 0,
            borderTopWidth: 1,
            borderTopColor: t.color.border,
            ...t.elevation.overlay,
          },
          tabBarLabelStyle: {
            fontFamily: fontFamily.medium,
            fontSize: typeScale.tabLabel.fontSize,
            letterSpacing: typeScale.tabLabel.letterSpacing,
            textTransform: 'none',
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

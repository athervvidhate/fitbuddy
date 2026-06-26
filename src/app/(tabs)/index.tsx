import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
  Platform,
  Pressable,
  Dimensions,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useUnits } from '../../context/UnitContext';
import { useWorkout } from '../../context/WorkoutContext';
import { supabase } from '../../lib/supabase';
import { BackgroundGlows } from '../../components/background-glows';
import { 
  Flame, 
  Calendar, 
  Dumbbell, 
  ChevronRight, 
  AlertCircle
} from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

export default function DashboardScreen() {
  const { profile, user } = useAuth();
  const { colors, isDark } = useTheme();
  const { formatWeight, weightUnit } = useUnits();

  // Premium adaptive theme tokens
  const themeCard = isDark ? 'bg-zinc-950/60 border-white/5' : 'bg-white border-zinc-200/80';
  const themeTextHeader = isDark ? 'text-[#e2e2e5]' : 'text-zinc-900';
  const themeTextSub = isDark ? 'text-zinc-400' : 'text-zinc-600';
  const themeHeaderBg = isDark ? 'bg-zinc-950/60 border-white/5' : 'bg-zinc-100/90 border-zinc-200';
  const themeBorder = isDark ? 'border-white/5' : 'border-zinc-200/80';
  const themeDivider = isDark ? 'border-white/5' : 'border-zinc-200/60';

  const { 
    startWorkout,
  } = useWorkout();

  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const systemFont = Platform.OS === 'ios' ? 'System' : 'sans-serif';

  const fetchHistory = async () => {
    if (!user) return;
    try {
      setLoadingHistory(true);
      const { data, error } = await supabase
        .from('workouts')
        .select(`
          id, name, started_at, completed_at, notes,
          workout_exercises (
            id, order_index,
            exercises (id, name, category),
            workout_sets (id, set_index, reps, weight, is_completed)
          )
        `)
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [user]);

  const handleQuickStart = () => {
    startWorkout('Blank Session');
  };

  const getWorkoutVolume = (workout: any) => {
    let volume = 0;
    workout.workout_exercises?.forEach((we: any) => {
      we.workout_sets?.forEach((set: any) => {
        if (set.is_completed) {
          volume += (set.weight || 0) * (set.reps || 0);
        }
      });
    });
    return volume;
  };

  const quickStartScale = useSharedValue(1);
  const quickStartAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: quickStartScale.value }],
  }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.dark }}>
      <BackgroundGlows />
      
      <ScrollView
        style={{ flex: 1, backgroundColor: 'transparent' }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 140 }}
        refreshControl = {
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchHistory(); }} tintColor="#ea580c" />
        }
      >
        {/* Welcome Header */}
        <View className={`flex-row justify-between items-center mb-6 pb-4 border-b ${themeDivider}`}>
          <View>
            <Text className="text-zinc-500 text-xs font-bold tracking-wider" style={{ fontFamily: systemFont }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </Text>
            <Text className={`text-xl font-bold mt-1.5 ${themeTextHeader}`} style={{ fontFamily: systemFont }}>
              Welcome, {profile?.username || 'Friend'}
            </Text>
          </View>
        </View>

        {/* Quick Start & Stats Cards */}
        <View className="flex-row gap-4 mb-6">
          <Pressable
            onPress={handleQuickStart}
            onPressIn={() => { quickStartScale.value = withSpring(0.96); }}
            onPressOut={() => { quickStartScale.value = withSpring(1); }}
            className="flex-[1.2]"
          >
            <Animated.View
              style={[
                quickStartAnimatedStyle,
                {
                  borderRadius: 24,
                  backgroundColor: isDark ? 'rgba(20, 20, 25, 0.7)' : '#ffffff',
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(234, 88, 12, 0.25)' : '#ea580c',
                  padding: 20,
                  height: 168,
                  justifyContent: 'space-between',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: isDark ? 0.35 : 0.1,
                  shadowRadius: 16,
                  elevation: 6,
                }
              ]}
            >
              <View>
                <Text className={`text-base font-bold tracking-wide uppercase ${themeTextHeader}`} style={{ fontFamily: systemFont }}>Quick Start</Text>
                <Text className={`text-xs mt-2.5 leading-relaxed ${themeTextSub}`} style={{ fontFamily: systemFont }}>Start a blank session and log your progress.</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Text className="text-[#ea580c] font-bold text-xs uppercase tracking-wider" style={{ fontFamily: systemFont }}>Start Workout</Text>
                <ChevronRight size={12} color="#ea580c" strokeWidth={3} />
              </View>
            </Animated.View>
          </Pressable>

          <View className="flex-1 gap-3.5">
            <View className={`flex-1 border p-4 justify-center h-[78px] ${themeCard}`} style={{ borderRadius: 20 }}>
              <Text className="text-zinc-500 text-xs font-bold" style={{ fontFamily: systemFont }}>Workouts Logged</Text>
              <Text className={`text-lg font-bold mt-1 ${themeTextHeader}`} style={{ fontFamily: systemFont }}>{history.length}</Text>
            </View>
            <View className={`flex-1 border p-4 justify-center h-[78px] ${themeCard}`} style={{ borderRadius: 20 }}>
              <Text className="text-zinc-500 text-xs font-bold" style={{ fontFamily: systemFont }}>Last Volume</Text>
              <Text className="text-sm font-bold text-[#ea580c] mt-1" style={{ fontFamily: systemFont }} numberOfLines={1}>
                {history.length > 0 ? formatWeight(getWorkoutVolume(history[0])) : `0 ${weightUnit}`}
              </Text>
            </View>
          </View>
        </View>

        {/* Workout History */}
        <View className="mb-24">
          <Text className="text-xs font-bold text-zinc-500 mb-4 ml-1 uppercase tracking-wider" style={{ fontFamily: systemFont }}>Workout History</Text>
          {loadingHistory ? (
            <View className="py-12 justify-center items-center"><ActivityIndicator size="small" color="#ea580c" /></View>
          ) : history.length === 0 ? (
            <View className={`border p-8 items-center justify-center ${themeCard}`} style={{ borderRadius: 24 }}>
              <AlertCircle size={24} color="#5c5c61" className="mb-2.5" />
              <Text className={`font-bold text-xs mb-1.5 ${themeTextSub}`} style={{ fontFamily: systemFont }}>No workouts logged yet</Text>
            </View>
          ) : (
            history.map((workout) => {
              const date = new Date(workout.completed_at);
              const durationMins = Math.round((new Date(workout.completed_at).getTime() - new Date(workout.started_at).getTime()) / 60000);
              return (
                <View key={workout.id} className={`border p-5 mb-4 ${themeCard}`} style={{ borderRadius: 24 }}>
                  <View className="flex-row justify-between items-start mb-3">
                    <View className="flex-1 pr-2">
                      <Text className={`font-bold text-base uppercase tracking-wide ${themeTextHeader}`} style={{ fontFamily: systemFont }}>{workout.name}</Text>
                      <View className="flex-row items-center mt-2">
                        <Calendar size={12} color="#71717a" className="mr-1.5" />
                        <Text className="text-zinc-500 text-xs font-semibold" style={{ fontFamily: systemFont }}>{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} | {durationMins} mins</Text>
                      </View>
                    </View>
                    <View className={`px-4 py-1.5 border ${themeBorder} ${isDark ? 'bg-zinc-900/60' : 'bg-zinc-100'}`} style={{ borderRadius: 100 }}>
                      <Text className="text-xs font-bold text-[#ea580c]" style={{ fontFamily: systemFont }}>Volume: {formatWeight(getWorkoutVolume(workout))}</Text>
                    </View>
                  </View>
                  <View className={`border-t pt-4 mt-3 ${themeDivider}`}>
                    {workout.workout_exercises?.slice(0, 3).map((we: any, idx: number) => (
                      <View key={we.id || idx} className="flex-row items-center mt-2">
                        <Dumbbell size={12} color="#ea580c" className="mr-2" strokeWidth={2} />
                        <Text className={`text-xs font-bold uppercase tracking-wider ${themeTextSub}`} style={{ fontFamily: systemFont }}>
                          {we.exercises?.name || 'Exercise'} <Text className="text-[#ea580c]">({we.workout_sets?.filter((s: any) => s.is_completed).length} sets)</Text>
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
  Platform,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useUnits } from '../../context/UnitContext';
import { supabase } from '../../lib/supabase';
import { BackgroundGlows } from '../../components/background-glows';
import { 
  BarChart2, 
  TrendingUp, 
  Activity, 
  Calendar,
  AlertTriangle,
  FileText
} from 'lucide-react-native';

const screenWidth = Dimensions.get('window').width;

type WorkoutStat = {
  dateLabel: string;
  volume: number;
  maxBench: number;
  maxSquat: number;
  maxDeadlift: number;
};

export default function AnalyticsScreen() {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const { displayWeightValue, weightUnit } = useUnits();

  // Data states
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'volume' | 'strength'>('volume');
  const [selectedExercise, setSelectedExercise] = useState<'Bench' | 'Squat' | 'Deadlift'>('Bench');

  const systemFont = Platform.OS === 'ios' ? 'System' : 'sans-serif';

  // Fetch all workouts to calculate statistics
  const fetchAnalyticsData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('workouts')
        .select(`
          id,
          name,
          completed_at,
          workout_exercises (
            exercise_id,
            exercises (name, category),
            workout_sets (reps, weight, is_completed)
          )
        `)
        .eq('user_id', user.id)
        .order('completed_at', { ascending: true }); // chronological order for charts

      if (error) throw error;
      setHistory(data || []);
    } catch (e) {
      console.error('Error fetching analytics data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, [user]);

  // Process data points for charting
  const getChartData = (): WorkoutStat[] => {
    return history.map((w: any) => {
      const date = new Date(w.completed_at);
      const dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      let totalVolume = 0;
      let maxBench = 0;
      let maxSquat = 0;
      let maxDeadlift = 0;

      w.workout_exercises?.forEach((we: any) => {
        const exName = (we.exercises?.name || '').toLowerCase();
        
        we.workout_sets?.forEach((set: any) => {
          if (set.is_completed) {
            const wKg = set.weight || 0;
            const reps = set.reps || 0;
            totalVolume += wKg * reps;

            // Calculate estimated 1RM using Epley formula
            const est1RM = wKg * (1 + reps / 30);

            if (exName.includes('bench press')) {
              maxBench = Math.max(maxBench, est1RM);
            } else if (exName.includes('squat')) {
              maxSquat = Math.max(maxSquat, est1RM);
            } else if (exName.includes('deadlift')) {
              maxDeadlift = Math.max(maxDeadlift, est1RM);
            }
          }
        });
      });

      return {
        dateLabel,
        volume: displayWeightValue(totalVolume),
        maxBench: displayWeightValue(maxBench),
        maxSquat: displayWeightValue(maxSquat),
        maxDeadlift: displayWeightValue(maxDeadlift),
      };
    });
  };

  const chartDataPoints = getChartData();
  const hasEnoughData = chartDataPoints.length >= 2;

  // Mock data for preview mode
  const mockChartData: WorkoutStat[] = [
    { dateLabel: 'Jun 01', volume: displayWeightValue(2400), maxBench: displayWeightValue(70), maxSquat: displayWeightValue(90), maxDeadlift: displayWeightValue(110) },
    { dateLabel: 'Jun 05', volume: displayWeightValue(2850), maxBench: displayWeightValue(72.5), maxSquat: displayWeightValue(95), maxDeadlift: displayWeightValue(115) },
    { dateLabel: 'Jun 10', volume: displayWeightValue(3200), maxBench: displayWeightValue(75), maxSquat: displayWeightValue(100), maxDeadlift: displayWeightValue(120) },
    { dateLabel: 'Jun 15', volume: displayWeightValue(3100), maxBench: displayWeightValue(75), maxSquat: displayWeightValue(100), maxDeadlift: displayWeightValue(125) },
    { dateLabel: 'Jun 20', volume: displayWeightValue(3600), maxBench: displayWeightValue(77.5), maxSquat: displayWeightValue(105), maxDeadlift: displayWeightValue(130) },
    { dateLabel: 'Jun 25', volume: displayWeightValue(4100), maxBench: displayWeightValue(80), maxSquat: displayWeightValue(110), maxDeadlift: displayWeightValue(140) },
  ];

  const activeDataPoints = hasEnoughData ? chartDataPoints : mockChartData;

  // Chart configuration styled to match Volcanic Ember Glassmorphism
  const chartConfig = {
    backgroundGradientFrom: 'rgba(15, 15, 20, 0.0)',
    backgroundGradientTo: 'rgba(15, 15, 20, 0.0)',
    backgroundGradientFromOpacity: 0,
    backgroundGradientToOpacity: 0,
    color: (opacity = 1) => `rgba(234, 88, 12, ${opacity})`, // Volcanic Orange
    labelColor: (opacity = 1) => isDark ? `rgba(161, 161, 170, ${opacity})` : `rgba(82, 82, 91, ${opacity})`,
    strokeWidth: 2.5,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
    decimalPlaces: 0,
    propsForDots: {
      r: '5',
      strokeWidth: '1.5',
      stroke: '#ea580c',
    },
    style: {
      borderRadius: 16,
    },
  };

  const getActiveDataset = () => {
    if (activeTab === 'volume') {
      return {
        labels: activeDataPoints.map((d) => d.dateLabel),
        datasets: [
          {
            data: activeDataPoints.map((d) => d.volume),
            color: (opacity = 1) => `rgba(234, 88, 12, ${opacity})`, // Orange
            strokeWidth: 2.5,
          },
        ],
        legend: [`Total Volume (${weightUnit})`],
      };
    } else {
      let data: number[] = [];
      let label = '';
      if (selectedExercise === 'Bench') {
        data = activeDataPoints.map((d) => d.maxBench);
        label = `Est. Bench 1RM (${weightUnit})`;
      } else if (selectedExercise === 'Squat') {
        data = activeDataPoints.map((d) => d.maxSquat);
        label = `Est. Squat 1RM (${weightUnit})`;
      } else {
        data = activeDataPoints.map((d) => d.maxDeadlift);
        label = `Est. Deadlift 1RM (${weightUnit})`;
      }

      const sanitizedData = data.map((v) => (v === 0 ? displayWeightValue(50) : v));

      return {
        labels: activeDataPoints.map((d) => d.dateLabel),
        datasets: [
          {
            data: sanitizedData,
            color: (opacity = 1) => `rgba(245, 158, 11, ${opacity})`, // Amber
            strokeWidth: 2.5,
          },
        ],
        legend: [label],
      };
    }
  };

  const totalWorkouts = history.length;
  const weeklyFrequency = Math.round((totalWorkouts / 4) * 10) / 10 || 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.dark }}>
      <BackgroundGlows />
      
      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 140 }}
      >
        {/* Header */}
        <View className={`mb-6 border-b pb-4 ${isDark ? 'border-white/5' : 'border-zinc-200'}`}>
          <Text 
            className={`text-[10px] tracking-wide font-semibold ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}
            style={{ fontFamily: systemFont }}
          >
            Training Insights
          </Text>
          <Text 
            className={`text-lg font-bold mt-1 ${isDark ? 'text-[#e2e2e5]' : 'text-zinc-900'}`}
            style={{ fontFamily: systemFont }}
          >
            Performance & Analytics
          </Text>
        </View>

        {loading ? (
          <View className="py-20 justify-center">
            <ActivityIndicator size="small" color="#ea580c" />
          </View>
        ) : (
          <View className="mb-20">
            {/* Quick Stats Grid */}
            <View className="flex-row gap-4 mb-6">
              {/* Stat Card 1 */}
              <View 
                className={`flex-1 border p-4 ${isDark ? 'bg-zinc-950/70 border-white/5' : 'bg-white border-zinc-200/80'}`}
                style={{
                  borderRadius: 24,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: isDark ? 0.35 : 0.08,
                  shadowRadius: 12,
                  elevation: 5,
                }}
              >
                <Text 
                  className={`text-[9px] font-semibold tracking-wide mb-2 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}
                  style={{ fontFamily: systemFont }}
                >
                  Total Workouts
                </Text>
                <Text 
                  className={`text-2xl font-bold ${isDark ? 'text-[#e2e2e5]' : 'text-zinc-900'}`}
                  style={{ fontFamily: systemFont }}
                >
                  {totalWorkouts}
                </Text>
                <Text 
                  className={`text-[10px] font-medium mt-1 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}
                  style={{ fontFamily: systemFont }}
                >
                  Workouts completed
                </Text>
              </View>

              {/* Stat Card 2 */}
              <View 
                className={`flex-1 border p-4 ${isDark ? 'bg-zinc-950/70 border-white/5' : 'bg-white border-zinc-200/80'}`}
                style={{
                  borderRadius: 24,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: isDark ? 0.35 : 0.08,
                  shadowRadius: 12,
                  elevation: 5,
                }}
              >
                <Text 
                  className={`text-[9px] font-semibold tracking-wide mb-2 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}
                  style={{ fontFamily: systemFont }}
                >
                  Weekly Frequency
                </Text>
                <Text 
                  className={`text-2xl font-bold ${isDark ? 'text-[#e2e2e5]' : 'text-zinc-900'}`}
                  style={{ fontFamily: systemFont }}
                >
                  {weeklyFrequency}/w
                </Text>
                <Text 
                  className={`text-[10px] font-medium mt-1 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}
                  style={{ fontFamily: systemFont }}
                >
                  Training density
                </Text>
              </View>
            </View>

            {/* Faux Preview Mode Banner */}
            {!hasEnoughData && (
              <View 
                className={`border p-4 mb-6 ${isDark ? 'border-[#ea580c]/30 bg-[#ea580c]/5' : 'border-[#ea580c]/20 bg-[#ea580c]/5'}`}
                style={{ borderRadius: 20 }}
              >
                <View className="flex-row items-center mb-1">
                  <AlertTriangle size={14} color="#ea580c" className="mr-1.5" strokeWidth={2.5} />
                  <Text 
                    className="text-[#ea580c] text-[10px] font-semibold tracking-wide"
                    style={{ fontFamily: systemFont }}
                  >
                    Simulated Display
                  </Text>
                </View>
                <Text 
                  className={`text-[11px] leading-relaxed font-medium mt-0.5 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}
                  style={{ fontFamily: systemFont }}
                >
                  Not enough workout logs yet (minimum 2 required). Showing mock training data to preview your metrics. Start tracking workouts to view your real analytics.
                </Text>
              </View>
            )}

            {/* Premium Segment Tab Selector */}
            <View 
              className={`flex-row p-1 mb-5 border ${isDark ? 'bg-zinc-950/80 border-white/5' : 'bg-zinc-100 border-zinc-200'}`}
              style={{ borderRadius: 16 }}
            >
              <TouchableOpacity
                onPress={() => setActiveTab('volume')}
                className="flex-1 py-2.5 items-center justify-center"
                style={{
                  borderRadius: 12,
                  backgroundColor: activeTab === 'volume' ? '#ea580c' : 'transparent',
                }}
              >
                <Text 
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ 
                    fontFamily: systemFont,
                    color: activeTab === 'volume' ? '#ffffff' : (isDark ? '#8e8e93' : '#71717a')
                  }}
                >
                  Volume Metrics
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setActiveTab('strength')}
                className="flex-1 py-2.5 items-center justify-center"
                style={{
                  borderRadius: 12,
                  backgroundColor: activeTab === 'strength' ? '#ea580c' : 'transparent',
                }}
              >
                <Text 
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ 
                    fontFamily: systemFont,
                    color: activeTab === 'strength' ? '#ffffff' : (isDark ? '#8e8e93' : '#71717a')
                  }}
                >
                  1RM Progression
                </Text>
              </TouchableOpacity>
            </View>

            {/* Exercise Sub-selector inside Strength mode */}
            {activeTab === 'strength' && (
              <View 
                className={`flex-row p-1 mb-5 border ${isDark ? 'bg-zinc-900/60 border-white/5' : 'bg-zinc-100/70 border-zinc-200'}`}
                style={{ borderRadius: 14 }}
              >
                {(['Bench', 'Squat', 'Deadlift'] as const).map((ex) => (
                  <TouchableOpacity
                    key={ex}
                    onPress={() => setSelectedExercise(ex)}
                    className="flex-1 py-2 items-center justify-center"
                    style={{
                      borderRadius: 10,
                      backgroundColor: selectedExercise === ex 
                        ? (isDark ? 'rgba(234, 88, 12, 0.15)' : 'rgba(234, 88, 12, 0.1)') 
                        : 'transparent',
                    }}
                  >
                    <Text 
                      className="text-[10px] font-bold uppercase tracking-wider"
                      style={{ 
                        fontFamily: systemFont,
                        color: selectedExercise === ex ? '#ea580c' : (isDark ? '#8e8e93' : '#71717a')
                      }}
                    >
                      {ex}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Velvet Glass Chart Area */}
            <View 
              className={`border p-4 items-center justify-center mb-6 ${isDark ? 'bg-zinc-950/70 border-white/5' : 'bg-white border-zinc-200/80'}`}
              style={{
                borderRadius: 24,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: isDark ? 0.4 : 0.08,
                shadowRadius: 18,
                elevation: 6,
              }}
            >
              <View className="flex-row items-center mb-4 self-start">
                <BarChart2 size={12} color="#ea580c" className="mr-1.5" strokeWidth={2} />
                <Text 
                  className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}
                  style={{ fontFamily: systemFont }}
                >
                  Performance Curve Output
                </Text>
              </View>
              <LineChart
                data={getActiveDataset()}
                width={screenWidth - 48}
                height={220}
                chartConfig={chartConfig}
                bezier
                style={{
                  marginVertical: 8,
                  borderRadius: 16,
                }}
              />
            </View>

            {/* Telemetry Readout Table */}
            <View 
              className={`border p-5 ${isDark ? 'bg-zinc-950/70 border-white/5' : 'bg-white border-zinc-200/80'}`}
              style={{
                borderRadius: 24,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: isDark ? 0.4 : 0.08,
                shadowRadius: 18,
                elevation: 6,
              }}
            >
              <View className="flex-row items-center mb-3.5">
                <FileText size={12} color="#ea580c" className="mr-1.5" />
                <Text 
                  className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}
                  style={{ fontFamily: systemFont }}
                >
                  Chronological Readout
                </Text>
              </View>
              
              <View className={`flex-row pb-2 border-b mb-2 px-1 ${isDark ? 'border-white/5' : 'border-zinc-200'}`}>
                <Text className={`w-16 text-[9px] font-bold uppercase ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} style={{ fontFamily: systemFont }}>Date</Text>
                <Text className={`flex-1 text-[9px] font-bold uppercase text-right ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} style={{ fontFamily: systemFont }}>Volume</Text>
                <Text className={`flex-1 text-[9px] font-bold uppercase text-right ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} style={{ fontFamily: systemFont }}>Bench 1RM</Text>
                <Text className={`flex-1 text-[9px] font-bold uppercase text-right ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} style={{ fontFamily: systemFont }}>Squat 1RM</Text>
              </View>

              {activeDataPoints.slice(-4).reverse().map((stat, idx) => (
                <View key={idx} className={`flex-row py-2.5 border-b px-1 items-center ${isDark ? 'border-white/5' : 'border-zinc-100'}`}>
                  <Text className={`w-16 text-[10px] font-bold ${isDark ? 'text-zinc-400' : 'text-zinc-700'}`} style={{ fontFamily: systemFont }}>{stat.dateLabel}</Text>
                  <Text className="flex-1 text-[10px] font-bold text-[#ea580c] text-right" style={{ fontFamily: systemFont }}>{stat.volume}</Text>
                  <Text className={`flex-1 text-[10px] font-bold text-right ${isDark ? 'text-zinc-400' : 'text-zinc-700'}`} style={{ fontFamily: systemFont }}>{stat.maxBench}</Text>
                  <Text className={`flex-1 text-[10px] font-bold text-right ${isDark ? 'text-zinc-400' : 'text-zinc-700'}`} style={{ fontFamily: systemFont }}>{stat.maxSquat}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

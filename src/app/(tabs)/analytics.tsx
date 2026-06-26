import React, { useState, useEffect, useRef } from 'react';
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
  FileText,
  Filter,
  Info,
  X
} from 'lucide-react-native';

const screenWidth = Dimensions.get('window').width;

type WorkoutStat = {
  dateLabel: string;
  volume: number;
  maxBench: number;
  maxSquat: number;
  maxDeadlift: number;
};

// Generates 13 weeks of realistic, structured training history for preview mode
const generateMockHistory = (): any[] => {
  const mock: any[] = [];
  const now = new Date();
  
  const exercisesForRoutine: Record<string, { name: string; category: string }[]> = {
    'Push Day': [
      { name: 'Bench Press (Barbell)', category: 'Chest' },
      { name: 'Overhead Press (Dumbbell)', category: 'Shoulders' },
      { name: 'Tricep Pushdown', category: 'Triceps' },
    ],
    'Pull Day': [
      { name: 'Deadlift (Barbell)', category: 'Back' },
      { name: 'Bent Over Row (Barbell)', category: 'Back' },
      { name: 'Bicep Curl (Dumbbell)', category: 'Biceps' },
    ],
    'Leg Day': [
      { name: 'Squat (Barbell)', category: 'Legs' },
      { name: 'Leg Press', category: 'Legs' },
      { name: 'Calf Raise', category: 'Legs' },
    ],
  };

  // Generate 3 workouts per week (Monday, Wednesday, Friday) for the last 13 weeks
  for (let week = 12; week >= 0; week--) {
    const monday = new Date(now.getTime() - week * 7 * 24 * 60 * 60 * 1000 - 4 * 24 * 60 * 60 * 1000);
    const wednesday = new Date(now.getTime() - week * 7 * 24 * 60 * 60 * 1000 - 2 * 24 * 60 * 60 * 1000);
    const friday = new Date(now.getTime() - week * 7 * 24 * 60 * 60 * 1000);

    const days = [
      { date: monday, routine: 'Leg Day' },
      { date: wednesday, routine: 'Push Day' },
      { date: friday, routine: 'Pull Day' },
    ];

    days.forEach(({ date, routine }) => {
      if (date > now) return;

      const workoutExercises = exercisesForRoutine[routine].map((ex) => {
        // Steady progression over the weeks
        const progressFactor = (12 - week) / 12;
        let baseWeight = 0;
        if (ex.name === 'Bench Press (Barbell)') baseWeight = 50 + progressFactor * 25; // 50kg -> 75kg
        else if (ex.name === 'Overhead Press (Dumbbell)') baseWeight = 14 + progressFactor * 6; // 14kg -> 20kg
        else if (ex.name === 'Tricep Pushdown') baseWeight = 20 + progressFactor * 10;
        else if (ex.name === 'Deadlift (Barbell)') baseWeight = 80 + progressFactor * 40; // 80kg -> 120kg
        else if (ex.name === 'Bent Over Row (Barbell)') baseWeight = 40 + progressFactor * 20;
        else if (ex.name === 'Bicep Curl (Dumbbell)') baseWeight = 10 + progressFactor * 6;
        else if (ex.name === 'Squat (Barbell)') baseWeight = 60 + progressFactor * 40; // 60kg -> 100kg
        else if (ex.name === 'Leg Press') baseWeight = 100 + progressFactor * 60;
        else if (ex.name === 'Calf Raise') baseWeight = 30 + progressFactor * 15;

        const sets = Array.from({ length: 3 }).map((_, setIdx) => ({
          reps: 8 + (setIdx % 2) * 2, // Alternating 8 and 10 reps
          weight: Math.round(baseWeight * (1 - setIdx * 0.05)), // 5% fatigue drop-off
          is_completed: true,
        }));

        return {
          exercise_id: `mock-${ex.name}`,
          exercises: ex,
          workout_sets: sets,
        };
      });

      mock.push({
        id: `mock-w-${routine}-${date.getTime()}`,
        name: routine,
        completed_at: date.toISOString(),
        workout_exercises: workoutExercises,
      });
    });
  }
  return mock;
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

  // Filtering states (Volume tab)
  const [filterType, setFilterType] = useState<'all' | 'routine' | 'exercise'>('all');
  const [selectedRoutine, setSelectedRoutine] = useState<string>('');
  const [selectedExerciseFilter, setSelectedExerciseFilter] = useState<string>('');

  // Active chart metric state (Volume vs Max Weight vs Total Reps)
  const [activeMetric, setActiveMetric] = useState<'volume' | 'weight' | 'reps'>('volume');

  // Selected point details for chart tooltip
  const [selectedPoint, setSelectedPoint] = useState<any>(null);

  // Ref for horizontal scrolling chart
  const scrollViewRef = useRef<ScrollView>(null);

  const systemFont = Platform.OS === 'ios' ? 'System' : 'sans-serif';

  // Reset selected point details when active tab, filters, or metrics change
  useEffect(() => {
    setSelectedPoint(null);
  }, [activeTab, filterType, selectedRoutine, selectedExerciseFilter, selectedExercise, activeMetric]);

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
        .order('completed_at', { ascending: true });

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

  // Filter out active/ongoing workouts (null completed_at) to avoid NaN sorting and chart alignment bugs
  const completedWorkouts = history.filter((w) => w.completed_at);
  const dataToUse = completedWorkouts.length >= 2 ? completedWorkouts : generateMockHistory();
  const hasEnoughData = completedWorkouts.length >= 2;

  // Extract unique routines and exercise names dynamically
  const uniqueRoutines = Array.from(
    new Set(dataToUse.map((w: any) => w.name).filter(Boolean))
  ).sort() as string[];

  const uniqueExercises = Array.from(
    new Set(
      dataToUse.flatMap((w: any) => 
        w.workout_exercises?.map((we: any) => we.exercises?.name) || []
      ).filter(Boolean)
    )
  ).sort() as string[];

  // Auto-select first option when filter type changes
  useEffect(() => {
    if (filterType === 'routine' && !selectedRoutine && uniqueRoutines.length > 0) {
      setSelectedRoutine(uniqueRoutines[0]);
    } else if (filterType === 'exercise' && !selectedExerciseFilter && uniqueExercises.length > 0) {
      setSelectedExerciseFilter(uniqueExercises[0]);
    }
  }, [filterType, history]);

  // Aggregates total volume, max weight, and total reps over 13 weeks (last 3 months)
  const getVolumeChartData = () => {
    const buckets: { 
      start: Date; 
      end: Date; 
      label: string; 
      volume: number; 
      maxWeight: number; 
      reps: number; 
      sessionCount: number; 
    }[] = [];
    const now = new Date();

    // Create 13 weekly buckets ending at the current timestamp
    for (let i = 12; i >= 0; i--) {
      const start = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
      const end = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      buckets.push({
        start,
        end,
        label: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        volume: 0,
        maxWeight: 0,
        reps: 0,
        sessionCount: 0,
      });
    }

    // Allocate workouts to their respective week buckets
    dataToUse.forEach((w: any) => {
      const workoutDate = new Date(w.completed_at);

      // Routine level filter
      if (filterType === 'routine' && selectedRoutine) {
        if (w.name?.toLowerCase() !== selectedRoutine.toLowerCase()) {
          return;
        }
      }

      let workoutVolume = 0;
      let workoutMaxWeight = 0;
      let workoutReps = 0;
      let hasCompletedSets = false;

      w.workout_exercises?.forEach((we: any) => {
        const exName = we.exercises?.name || '';

        // Exercise level filter
        if (filterType === 'exercise' && selectedExerciseFilter) {
          if (exName.toLowerCase() !== selectedExerciseFilter.toLowerCase()) {
            return;
          }
        }

        we.workout_sets?.forEach((set: any) => {
          if (set.is_completed) {
            const wKg = set.weight || 0;
            const reps = set.reps || 0;
            workoutVolume += wKg * reps;
            workoutMaxWeight = Math.max(workoutMaxWeight, wKg);
            workoutReps += reps;
            hasCompletedSets = true;
          }
        });
      });

      // Assign to correct bucket
      const bucket = buckets.find((b) => workoutDate >= b.start && workoutDate < b.end);
      if (bucket) {
        bucket.volume += workoutVolume;
        bucket.maxWeight = Math.max(bucket.maxWeight, workoutMaxWeight);
        bucket.reps += workoutReps;
        if (hasCompletedSets && (workoutVolume > 0 || workoutReps > 0)) {
          bucket.sessionCount += 1;
        }
      } else {
        const lastBucket = buckets[12];
        if (workoutDate >= lastBucket.start && workoutDate <= now) {
          lastBucket.volume += workoutVolume;
          lastBucket.maxWeight = Math.max(lastBucket.maxWeight, workoutMaxWeight);
          lastBucket.reps += workoutReps;
          if (hasCompletedSets && (workoutVolume > 0 || workoutReps > 0)) {
            lastBucket.sessionCount += 1;
          }
        }
      }
    });

    return buckets.map((b) => {
      let activeVal = 0;
      if (activeMetric === 'volume') {
        activeVal = displayWeightValue(b.volume);
      } else if (activeMetric === 'weight') {
        activeVal = displayWeightValue(b.maxWeight);
      } else {
        activeVal = b.reps;
      }

      return {
        dateLabel: b.label,
        value: activeVal,
        rawVolume: displayWeightValue(b.volume),
        rawWeight: displayWeightValue(b.maxWeight),
        rawReps: b.reps,
        startDateStr: b.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        endDateStr: b.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        sessionCount: b.sessionCount,
      };
    });
  };

  // Aggregates session-by-session history chronologically for a filtered routine or exercise
  const getFilteredSessionData = () => {
    const points: { 
      dateLabel: string; 
      value: number; 
      rawVolume: number; 
      rawWeight: number; 
      rawReps: number; 
      sessionCount: number; 
      startDateStr: string; 
      endDateStr: string; 
    }[] = [];

    // Sort chronologically by date
    const sortedData = [...dataToUse].sort((a: any, b: any) => 
      new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime()
    );

    sortedData.forEach((w: any) => {
      const workoutDate = new Date(w.completed_at);

      // Routine level filter
      if (filterType === 'routine' && selectedRoutine) {
        if (w.name?.toLowerCase() !== selectedRoutine.toLowerCase()) {
          return;
        }
      }

      let sessionVolume = 0;
      let sessionMaxWeight = 0;
      let sessionTotalReps = 0;
      let hasCompletedSets = false;

      w.workout_exercises?.forEach((we: any) => {
        const exName = we.exercises?.name || '';

        // Exercise level filter
        if (filterType === 'exercise' && selectedExerciseFilter) {
          if (exName.toLowerCase() !== selectedExerciseFilter.toLowerCase()) {
            return;
          }
        }

        we.workout_sets?.forEach((set: any) => {
          if (set.is_completed) {
            const wKg = set.weight || 0;
            const reps = set.reps || 0;
            sessionVolume += wKg * reps;
            sessionMaxWeight = Math.max(sessionMaxWeight, wKg);
            sessionTotalReps += reps;
            hasCompletedSets = true;
          }
        });
      });

      if (hasCompletedSets) {
        let activeVal = 0;
        if (activeMetric === 'volume') {
          activeVal = displayWeightValue(sessionVolume);
        } else if (activeMetric === 'weight') {
          activeVal = displayWeightValue(sessionMaxWeight);
        } else {
          activeVal = sessionTotalReps;
        }

        points.push({
          dateLabel: workoutDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          value: activeVal,
          rawVolume: displayWeightValue(sessionVolume),
          rawWeight: displayWeightValue(sessionMaxWeight),
          rawReps: sessionTotalReps,
          sessionCount: 1,
          startDateStr: workoutDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          endDateStr: workoutDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        });
      }
    });

    return points;
  };

  // Process individual workout data points for strength 1RM progression
  const getStrengthChartData = (): WorkoutStat[] => {
    const sortedData = [...dataToUse].sort((a: any, b: any) => 
      new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime()
    );

    return sortedData.map((w: any) => {
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

  // Click handler for data points in the chart
  const handleDataPointClick = (data: any) => {
    const index = data.index;
    if (activeTab === 'volume') {
      const volumePoints = filterType === 'all' ? getVolumeChartData() : getFilteredSessionData();
      const point = volumePoints[index];
      setSelectedPoint({
        type: 'volume',
        label: filterType === 'all' ? `${point.dateLabel} - Week` : point.dateLabel,
        startDateStr: point.startDateStr,
        endDateStr: point.endDateStr,
        value: point.value,
        unit: activeMetric === 'reps' ? 'reps' : weightUnit,
        sessionCount: point.sessionCount || 0,
        avgVolume: point.sessionCount > 0 ? Math.round(point.rawVolume / point.sessionCount) : 0,
        filterApplied: filterType === 'all' 
          ? 'All Workouts' 
          : filterType === 'routine' 
            ? `Routine: ${selectedRoutine}` 
            : `Exercise: ${selectedExerciseFilter}`,
        metric: activeMetric,
        rawVolume: point.rawVolume,
        rawWeight: point.rawWeight,
        rawReps: point.rawReps,
      });
    } else {
      const strengthPoints = getStrengthChartData().slice(-8);
      const point = strengthPoints[index];
      let val = 0;
      let exLabel = '';
      if (selectedExercise === 'Bench') {
        val = point.maxBench;
        exLabel = 'Bench Press';
      } else if (selectedExercise === 'Squat') {
        val = point.maxSquat;
        exLabel = 'Squat';
      } else {
        val = point.maxDeadlift;
        exLabel = 'Deadlift';
      }

      setSelectedPoint({
        type: 'strength',
        label: point.dateLabel,
        value: Math.round(val),
        unit: weightUnit,
        exerciseName: exLabel,
      });
    }
  };

  // Chart configuration matching Volcanic Ember aesthetics
  const chartConfig = {
    backgroundGradientFrom: 'rgba(15, 15, 20, 0.0)',
    backgroundGradientTo: 'rgba(15, 15, 20, 0.0)',
    backgroundGradientFromOpacity: 0,
    backgroundGradientToOpacity: 0,
    color: (opacity = 1) => `rgba(234, 88, 12, ${opacity})`,
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
      const volumePoints = filterType === 'all' ? getVolumeChartData() : getFilteredSessionData();
      
      return {
        labels: volumePoints.map((d, index) => {
          // Always show the first and the very last labels to guarantee boundaries are visible
          if (index === 0 || index === volumePoints.length - 1) {
            return d.dateLabel;
          }
          if (filterType === 'all') {
            // Thin weekly labels on default 3-month page
            return index % 3 === 0 ? d.dateLabel : '';
          } else {
            // Show every 2nd label on filtered scrollable chart (60px spaced)
            return index % 2 === 0 ? d.dateLabel : '';
          }
        }),
        datasets: [
          {
            data: volumePoints.map((d) => d.value),
            color: (opacity = 1) => `rgba(234, 88, 12, ${opacity})`,
            strokeWidth: 2.5,
          },
        ],
        legend: [
          activeMetric === 'volume' 
            ? `Total Volume (${weightUnit})` 
            : activeMetric === 'weight' 
              ? `Max Weight (${weightUnit})` 
              : 'Total Reps'
        ],
      };
    } else {
      const strengthPoints = getStrengthChartData();
      let data: number[] = [];
      let label = '';
      if (selectedExercise === 'Bench') {
        data = strengthPoints.map((d) => d.maxBench);
        label = `Est. Bench 1RM (${weightUnit})`;
      } else if (selectedExercise === 'Squat') {
        data = strengthPoints.map((d) => d.maxSquat);
        label = `Est. Squat 1RM (${weightUnit})`;
      } else {
        data = strengthPoints.map((d) => d.maxDeadlift);
        label = `Est. Deadlift 1RM (${weightUnit})`;
      }

      const sanitizedData = data.map((v) => (v === 0 ? displayWeightValue(50) : v));

      const displayPoints = strengthPoints.slice(-8);
      const displayData = sanitizedData.slice(-8);

      return {
        labels: displayPoints.map((d, index) => {
          if (index === 0 || index === displayPoints.length - 1) {
            return d.dateLabel;
          }
          return index % 2 === 0 ? d.dateLabel : '';
        }),
        datasets: [
          {
            data: displayData,
            color: (opacity = 1) => `rgba(245, 158, 11, ${opacity})`,
            strokeWidth: 2.5,
          },
        ],
        legend: [label],
      };
    }
  };

  const totalWorkouts = dataToUse.length;
  const weeklyFrequency = Math.round((totalWorkouts / 13) * 10) / 10 || 0;

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
            className={`text-xs tracking-wide font-semibold ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}
            style={{ fontFamily: systemFont }}
          >
            Training Insights
          </Text>
          <Text 
            className={`text-xl font-bold mt-1 ${isDark ? 'text-[#e2e2e5]' : 'text-zinc-900'}`}
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
                  className={`text-xs font-semibold tracking-wide mb-2 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}
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
                  className={`text-xs font-medium mt-1 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}
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
                  className={`text-xs font-semibold tracking-wide mb-2 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}
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
                  className={`text-xs font-medium mt-1 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}
                  style={{ fontFamily: systemFont }}
                >
                  3-month average
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
                    className="text-[#ea580c] text-xs font-semibold tracking-wide"
                    style={{ fontFamily: systemFont }}
                  >
                    Simulated Display
                  </Text>
                </View>
                <Text 
                  className={`text-sm leading-relaxed font-medium mt-0.5 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}
                  style={{ fontFamily: systemFont }}
                >
                  Not enough workout logs yet (minimum 2 required). Showing dynamic mock training data to preview your metrics. Start tracking workouts to view your real analytics.
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
                className="flex-1 py-3.5 items-center justify-center min-h-[44px]"
                style={{
                  borderRadius: 12,
                  backgroundColor: activeTab === 'volume' ? '#ea580c' : 'transparent',
                }}
              >
                <Text 
                  className="text-sm font-bold uppercase tracking-wider"
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
                className="flex-1 py-3.5 items-center justify-center min-h-[44px]"
                style={{
                  borderRadius: 12,
                  backgroundColor: activeTab === 'strength' ? '#ea580c' : 'transparent',
                }}
              >
                <Text 
                  className="text-sm font-bold uppercase tracking-wider"
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
                    className="flex-1 py-2.5 items-center justify-center min-h-[44px]"
                    style={{
                      borderRadius: 10,
                      backgroundColor: selectedExercise === ex 
                        ? (isDark ? 'rgba(234, 88, 12, 0.15)' : 'rgba(234, 88, 12, 0.1)') 
                        : 'transparent',
                    }}
                  >
                    <Text 
                      className="text-xs font-bold uppercase tracking-wider"
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

            {/* Dynamic Volume Filter Control Panel */}
            {activeTab === 'volume' && (
              <View 
                className={`border p-4 mb-6 ${isDark ? 'bg-zinc-950/70 border-white/5' : 'bg-white border-zinc-200/80'}`}
                style={{
                  borderRadius: 24,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: isDark ? 0.35 : 0.08,
                  shadowRadius: 12,
                  elevation: 5,
                }}
              >
                <View className="flex-row items-center mb-3">
                  <Filter size={14} color="#ea580c" className="mr-2" />
                  <Text 
                    className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-700'}`}
                    style={{ fontFamily: systemFont }}
                  >
                    Filter & Metric Scope
                  </Text>
                </View>

                {/* Main Filter Selection Segments */}
                <View 
                  className={`flex-row p-1 mb-3 border ${isDark ? 'bg-zinc-900/50 border-white/5' : 'bg-zinc-100 border-zinc-200'}`}
                  style={{ borderRadius: 14 }}
                >
                  {(['all', 'routine', 'exercise'] as const).map((type) => (
                    <TouchableOpacity
                      key={type}
                      onPress={() => setFilterType(type)}
                      className="flex-1 py-2 items-center justify-center min-h-[44px]"
                      style={{
                        borderRadius: 10,
                        backgroundColor: filterType === type ? '#ea580c' : 'transparent',
                      }}
                    >
                      <Text 
                        className="text-xs font-bold uppercase tracking-wider"
                        style={{ 
                          fontFamily: systemFont,
                          color: filterType === type ? '#ffffff' : (isDark ? '#8e8e93' : '#71717a')
                        }}
                      >
                        {type === 'all' ? 'All' : type === 'routine' ? 'Routine' : 'Exercise'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Sub-Filters (Horizontal scroll arrays) */}
                {filterType === 'routine' && uniqueRoutines.length > 0 && (
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingVertical: 4, gap: 8 }}
                  >
                    {uniqueRoutines.map((routine) => {
                      const isSelected = selectedRoutine.toLowerCase() === routine.toLowerCase();
                      return (
                        <TouchableOpacity
                          key={routine}
                          onPress={() => setSelectedRoutine(routine)}
                          className={`px-4 py-2.5 border rounded-full justify-center items-center min-h-[44px] ${
                            isSelected 
                              ? 'bg-[#ea580c]/15 border-[#ea580c]' 
                              : (isDark ? 'bg-zinc-900/40 border-white/5' : 'bg-zinc-100/60 border-zinc-200')
                          }`}
                        >
                          <Text 
                            className={`text-xs font-bold ${
                              isSelected ? 'text-[#ea580c]' : (isDark ? 'text-zinc-400' : 'text-zinc-600')
                            }`}
                            style={{ fontFamily: systemFont }}
                          >
                            {routine}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}

                {filterType === 'exercise' && uniqueExercises.length > 0 && (
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingVertical: 4, gap: 8 }}
                  >
                    {uniqueExercises.map((exercise) => {
                      const isSelected = selectedExerciseFilter.toLowerCase() === exercise.toLowerCase();
                      return (
                        <TouchableOpacity
                          key={exercise}
                          onPress={() => setSelectedExerciseFilter(exercise)}
                          className={`px-4 py-2.5 border rounded-full justify-center items-center min-h-[44px] ${
                            isSelected 
                              ? 'bg-[#ea580c]/15 border-[#ea580c]' 
                              : (isDark ? 'bg-zinc-900/40 border-white/5' : 'bg-zinc-100/60 border-zinc-200')
                          }`}
                        >
                          <Text 
                            className={`text-xs font-bold ${
                              isSelected ? 'text-[#ea580c]' : (isDark ? 'text-zinc-400' : 'text-zinc-600')
                            }`}
                            style={{ fontFamily: systemFont }}
                          >
                            {exercise}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}

                {/* Metric Selection Segments */}
                <View className="mt-4 border-t pt-3.5" style={{ borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                  <Text 
                    className={`text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-zinc-400' : 'text-zinc-700'}`}
                    style={{ fontFamily: systemFont }}
                  >
                    Chart Metric
                  </Text>
                  <View 
                    className={`flex-row p-1 border ${isDark ? 'bg-zinc-900/50 border-white/5' : 'bg-zinc-100 border-zinc-200'}`}
                    style={{ borderRadius: 14 }}
                  >
                    {(['volume', 'weight', 'reps'] as const).map((metric) => (
                      <TouchableOpacity
                        key={metric}
                        onPress={() => setActiveMetric(metric)}
                        className="flex-1 py-2 items-center justify-center min-h-[44px]"
                        style={{
                          borderRadius: 10,
                          backgroundColor: activeMetric === metric ? '#ea580c' : 'transparent',
                        }}
                      >
                        <Text 
                          className="text-xs font-bold uppercase tracking-wider"
                          style={{ 
                            fontFamily: systemFont,
                            color: activeMetric === metric ? '#ffffff' : (isDark ? '#8e8e93' : '#71717a')
                          }}
                        >
                          {metric === 'volume' ? 'Volume' : metric === 'weight' ? 'Max Weight' : 'Reps'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {/* Velvet Glass Chart Area */}
            <View 
              className={`border p-4 mb-6 ${isDark ? 'bg-zinc-950/70 border-white/5' : 'bg-white border-zinc-200/80'}`}
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
                <BarChart2 size={14} color="#ea580c" className="mr-2" strokeWidth={2.5} />
                <Text 
                  className={`text-xs font-bold uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}
                  style={{ fontFamily: systemFont }}
                >
                  {activeTab === 'volume' 
                    ? `${activeMetric === 'volume' ? 'Weekly Volume' : activeMetric === 'weight' ? 'Weekly Max Weight' : 'Weekly Total Reps'} curve` 
                    : '1RM Performance curve'}
                </Text>
              </View>
              
              {/* Clean side-by-side Y-axis layout (Fixed on the Left, Scrollable Timeline on the Right) */}
              <View className="flex-row w-full items-center justify-start">
                {/* Fixed Y-Axis Labels Column (Fixed on the Left, width 52, with 8px right margin for breathing room) */}
                <View style={{ width: 52, overflow: 'hidden', height: 220, justifyContent: 'center', marginRight: 8 }}>
                  <LineChart
                    data={{
                      ...getActiveDataset(),
                      datasets: getActiveDataset().datasets.map((ds: any) => ({
                        ...ds,
                        color: () => 'transparent', // Make the chart line and fill completely transparent
                        strokeWidth: 0, // Set stroke width to 0 to be safe
                      })),
                      legend: [], // Hide legend to avoid duplicate legend text
                    }}
                    width={screenWidth - 48}
                    height={220}
                    chartConfig={{
                      ...chartConfig,
                      backgroundGradientFromOpacity: 0,
                      backgroundGradientToOpacity: 0,
                      propsForDots: { r: '0', strokeWidth: '0', stroke: 'transparent' }, // Hide dots
                    }}
                    bezier
                    withVerticalLabels={false} // Hide X-axis labels
                    withHorizontalLabels={true} // Show Y-axis labels
                    withInnerLines={false} // Hide grid lines
                    withOuterLines={false} // Hide outer border lines
                    style={{
                      marginVertical: 8, // Match the main chart's vertical margin for perfect alignment
                      marginLeft: 0,
                    }}
                  />
                </View>

                {/* Horizontal Scrollable Chart Grid Content (Scrolls cleanly on the Right, zero overlap) */}
                {activeTab === 'volume' && filterType !== 'all' ? (
                  <ScrollView 
                    ref={scrollViewRef}
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingRight: 16 }}
                    onContentSizeChange={() => {
                      scrollViewRef.current?.scrollToEnd({ animated: false });
                    }}
                  >
                    <LineChart
                      data={getActiveDataset()}
                      // Width adjusted: ContainerWidth (screenWidth - 48 - 52 - 8) + negative margin offset (44)
                      width={Math.max(screenWidth - 48 - 52 - 8, getFilteredSessionData().length * 60) + 44}
                      height={220}
                      chartConfig={chartConfig}
                      bezier
                      withHorizontalLabels={false} // HIDE Y-axis labels completely so they never scroll or show duplicate
                      withVerticalLabels={true} // show X-axis labels
                      withOuterLines={false} // hide outer box border so last dot aligns exactly with last vertical line
                      onDataPointClick={handleDataPointClick}
                      style={{
                        marginVertical: 8,
                        borderRadius: 16,
                        marginLeft: -44, // Shift left to completely hide empty Y-axis label padding space
                      }}
                    />
                  </ScrollView>
                ) : (
                  <View style={{ flex: 1 }}>
                    <LineChart
                      data={getActiveDataset()}
                      // Width adjusted: ContainerWidth (screenWidth - 48 - 52 - 8) + negative margin offset (44)
                      width={screenWidth - 48 - 52 - 8 + 44}
                      height={220}
                      chartConfig={chartConfig}
                      bezier
                      withHorizontalLabels={false} // HIDE Y-axis labels
                      withVerticalLabels={true}
                      withOuterLines={false} // hide outer box border
                      onDataPointClick={handleDataPointClick}
                      style={{
                        marginVertical: 8,
                        borderRadius: 16,
                        marginLeft: -44, // Shift left to completely hide empty Y-axis label padding space
                      }}
                    />
                  </View>
                )}
              </View>
            </View>

            {/* Click Detail Tooltip Card */}
            {selectedPoint && (
              <View 
                className={`border p-5 mb-6 ${isDark ? 'bg-zinc-950/90 border-[#ea580c]/30' : 'bg-white border-[#ea580c]/20'}`}
                style={{
                  borderRadius: 24,
                  shadowColor: '#ea580c',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: isDark ? 0.15 : 0.05,
                  shadowRadius: 10,
                  elevation: 4,
                }}
              >
                {/* Header of detail card */}
                <View className="flex-row items-center justify-between mb-4">
                  <View className="flex-row items-center">
                    <Info size={16} color="#ea580c" className="mr-2" />
                    <Text 
                      className={`text-sm font-bold uppercase tracking-wider ${isDark ? 'text-zinc-300' : 'text-zinc-800'}`}
                      style={{ fontFamily: systemFont }}
                    >
                      Point Details
                    </Text>
                  </View>
                  <TouchableOpacity 
                    onPress={() => setSelectedPoint(null)}
                    className="p-1.5 rounded-full items-center justify-center min-w-[32px] min-h-[32px]"
                    style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
                  >
                    <X size={14} color={isDark ? '#a1a1aa' : '#52525b'} />
                  </TouchableOpacity>
                </View>

                {/* Details layout */}
                {selectedPoint.type === 'volume' ? (
                  <View className="gap-3">
                    <View className="flex-row justify-between items-center">
                      <Text className={`text-xs font-semibold ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} style={{ fontFamily: systemFont }}>
                        {filterType === 'all' ? 'Week Range' : 'Workout Date'}
                      </Text>
                      <Text className={`text-sm font-bold ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`} style={{ fontFamily: systemFont }}>
                        {filterType === 'all' 
                          ? `${selectedPoint.startDateStr} - ${selectedPoint.endDateStr}`
                          : selectedPoint.startDateStr
                        }
                      </Text>
                    </View>
                    
                    <View className="flex-row justify-between items-center border-t pt-2.5" style={{ borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                      <Text className={`text-xs font-semibold ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} style={{ fontFamily: systemFont }}>Total Volume</Text>
                      <Text className={`text-sm font-bold ${selectedPoint.metric === 'volume' ? 'text-base font-extrabold text-[#ea580c]' : (isDark ? 'text-zinc-300' : 'text-zinc-700')}`} style={{ fontFamily: systemFont }}>
                        {selectedPoint.rawVolume.toLocaleString()} {weightUnit}
                      </Text>
                    </View>

                    <View className="flex-row justify-between items-center border-t pt-2.5" style={{ borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                      <Text className={`text-xs font-semibold ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} style={{ fontFamily: systemFont }}>Max Weight Lifted</Text>
                      <Text className={`text-sm font-bold ${selectedPoint.metric === 'weight' ? 'text-base font-extrabold text-[#ea580c]' : (isDark ? 'text-zinc-300' : 'text-zinc-700')}`} style={{ fontFamily: systemFont }}>
                        {selectedPoint.rawWeight.toLocaleString()} {weightUnit}
                      </Text>
                    </View>

                    <View className="flex-row justify-between items-center border-t pt-2.5" style={{ borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                      <Text className={`text-xs font-semibold ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} style={{ fontFamily: systemFont }}>Total Reps</Text>
                      <Text className={`text-sm font-bold ${selectedPoint.metric === 'reps' ? 'text-base font-extrabold text-[#ea580c]' : (isDark ? 'text-zinc-300' : 'text-zinc-700')}`} style={{ fontFamily: systemFont }}>
                        {selectedPoint.rawReps.toLocaleString()} reps
                      </Text>
                    </View>

                    {filterType === 'all' && (
                      <>
                        <View className="flex-row justify-between items-center border-t pt-2.5" style={{ borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                          <Text className={`text-xs font-semibold ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} style={{ fontFamily: systemFont }}>Workouts Logged</Text>
                          <Text className={`text-sm font-bold ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`} style={{ fontFamily: systemFont }}>
                            {selectedPoint.sessionCount} {selectedPoint.sessionCount === 1 ? 'session' : 'sessions'}
                          </Text>
                        </View>
                        <View className="flex-row justify-between items-center border-t pt-2.5" style={{ borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                          <Text className={`text-xs font-semibold ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} style={{ fontFamily: systemFont }}>Avg Vol / Session</Text>
                          <Text className={`text-sm font-bold ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`} style={{ fontFamily: systemFont }}>
                            {selectedPoint.avgVolume.toLocaleString()} {weightUnit}
                          </Text>
                        </View>
                      </>
                    )}

                    <View className="flex-row justify-between items-center border-t pt-2.5" style={{ borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                      <Text className={`text-xs font-semibold ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} style={{ fontFamily: systemFont }}>Active Scope</Text>
                      <Text className="text-xs font-bold text-[#ea580c] bg-[#ea580c]/10 px-2.5 py-1 rounded-full overflow-hidden" style={{ fontFamily: systemFont }}>
                        {selectedPoint.filterApplied}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View className="gap-3">
                    <View className="flex-row justify-between items-center">
                      <Text className={`text-xs font-semibold ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} style={{ fontFamily: systemFont }}>Workout Date</Text>
                      <Text className={`text-sm font-bold ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`} style={{ fontFamily: systemFont }}>
                        {selectedPoint.label}
                      </Text>
                    </View>
                    <View className="flex-row justify-between items-center border-t pt-2.5" style={{ borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                      <Text className={`text-xs font-semibold ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} style={{ fontFamily: systemFont }}>Estimated 1RM</Text>
                      <Text className="text-base font-extrabold text-[#f59e0b]" style={{ fontFamily: systemFont }}>
                        {selectedPoint.value.toLocaleString()} {selectedPoint.unit}
                      </Text>
                    </View>
                    <View className="flex-row justify-between items-center border-t pt-2.5" style={{ borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                      <Text className={`text-xs font-semibold ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} style={{ fontFamily: systemFont }}>Exercise Name</Text>
                      <Text className={`text-sm font-bold ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`} style={{ fontFamily: systemFont }}>
                        {selectedPoint.exerciseName}
                      </Text>
                    </View>
                    <View className="flex-row justify-between items-center border-t pt-2.5" style={{ borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                      <Text className={`text-xs font-semibold ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} style={{ fontFamily: systemFont }}>Calculation Model</Text>
                      <Text className={`text-xs font-semibold ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`} style={{ fontFamily: systemFont }}>
                        Epley formula (Weight * (1 + Reps / 30))
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}

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
                <FileText size={14} color="#ea580c" className="mr-2" />
                <Text 
                  className={`text-xs font-bold uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}
                  style={{ fontFamily: systemFont }}
                >
                  {activeTab === 'volume' ? 'Volume Telemetry Readout' : '1RM Strength Telemetry'}
                </Text>
              </View>
              
              {activeTab === 'volume' ? (
                <>
                  <View className={`flex-row pb-2 border-b mb-2 px-1 ${isDark ? 'border-white/5' : 'border-zinc-200'}`}>
                    <Text className={`w-28 text-xs font-bold uppercase ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} style={{ fontFamily: systemFont }}>
                      {filterType === 'all' ? 'Week Beginning' : 'Workout Date'}
                    </Text>
                    <Text className={`flex-1 text-xs font-bold uppercase text-right ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} style={{ fontFamily: systemFont }}>
                      {activeMetric === 'volume' 
                        ? `Total Volume (${weightUnit})` 
                        : activeMetric === 'weight' 
                          ? `Max Weight (${weightUnit})` 
                          : 'Total Reps'}
                    </Text>
                  </View>

                  {(filterType === 'all' ? getVolumeChartData() : getFilteredSessionData())
                    .filter((stat) => stat.value > 0)
                    .reverse()
                    .slice(0, 8)
                    .map((stat, idx) => (
                      <View key={idx} className={`flex-row py-3 border-b px-1 items-center ${isDark ? 'border-white/5' : 'border-zinc-100'}`}>
                        <Text className={`w-28 text-sm font-semibold ${isDark ? 'text-zinc-400' : 'text-zinc-700'}`} style={{ fontFamily: systemFont }}>{stat.dateLabel}</Text>
                        <Text className="flex-1 text-sm font-bold text-[#ea580c] text-right" style={{ fontFamily: systemFont }}>
                          {stat.value.toLocaleString()}
                        </Text>
                      </View>
                    ))
                  }
                  {(filterType === 'all' ? getVolumeChartData() : getFilteredSessionData()).filter((stat) => stat.value > 0).length === 0 && (
                    <Text className={`text-xs text-center py-4 ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>No training records found</Text>
                  )}
                </>
              ) : (
                <>
                  <View className={`flex-row pb-2 border-b mb-2 px-1 ${isDark ? 'border-white/5' : 'border-zinc-200'}`}>
                    <Text className={`w-20 text-xs font-bold uppercase ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} style={{ fontFamily: systemFont }}>Date</Text>
                    <Text className={`flex-1 text-xs font-bold uppercase text-right ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} style={{ fontFamily: systemFont }}>Bench ({weightUnit})</Text>
                    <Text className={`flex-1 text-xs font-bold uppercase text-right ${isDark ? 'text-[#e2e2e5]' : 'text-zinc-900'}`} style={{ fontFamily: systemFont }}>Squat ({weightUnit})</Text>
                    <Text className={`flex-1 text-xs font-bold uppercase text-right ${isDark ? 'text-[#e2e2e5]' : 'text-zinc-900'}`} style={{ fontFamily: systemFont }}>Deadlift ({weightUnit})</Text>
                  </View>

                  {getStrengthChartData()
                    .reverse()
                    .slice(0, 6)
                    .map((stat, idx) => (
                      <View key={idx} className={`flex-row py-3 border-b px-1 items-center ${isDark ? 'border-white/5' : 'border-zinc-100'}`}>
                        <Text className={`w-20 text-sm font-semibold ${isDark ? 'text-zinc-400' : 'text-zinc-700'}`} style={{ fontFamily: systemFont }}>{stat.dateLabel}</Text>
                        <Text className="flex-1 text-sm font-bold text-right text-[#ea580c]" style={{ fontFamily: systemFont }}>{stat.maxBench > 0 ? Math.round(stat.maxBench) : '-'}</Text>
                        <Text className={`flex-1 text-sm font-bold text-right ${isDark ? 'text-zinc-400' : 'text-zinc-700'}`} style={{ fontFamily: systemFont }}>{stat.maxSquat > 0 ? Math.round(stat.maxSquat) : '-'}</Text>
                        <Text className={`flex-1 text-sm font-bold text-right ${isDark ? 'text-zinc-400' : 'text-zinc-700'}`} style={{ fontFamily: systemFont }}>{stat.maxDeadlift > 0 ? Math.round(stat.maxDeadlift) : '-'}</Text>
                      </View>
                    ))
                  }
                </>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

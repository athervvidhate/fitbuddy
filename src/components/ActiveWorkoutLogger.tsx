import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  Alert,
  Platform,
  Pressable,
  Dimensions,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useUnits } from '../context/UnitContext';
import { useWorkout } from '../context/WorkoutContext';
import { supabase } from '../lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import exercisesData from '../data/exercises.json';
import { BackgroundGlows } from './background-glows';
import { 
  Flame, 
  Clock, 
  Plus, 
  Check, 
  X, 
  Dumbbell, 
  ChevronRight, 
  AlertCircle,
  FileText,
  ChevronUp,
  ChevronDown
} from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

// Isolated Set Row Component for high-performance input editing and micro-animations
interface SetRowProps {
  set: any;
  setIdx: number;
  exIdx: number;
  updateSetLog: (exIdx: number, setIdx: number, fields: any) => void;
  triggerRestTimer: (seconds: number) => void;
  weightUnit: string;
}

function SetRow({ set, setIdx, exIdx, updateSetLog, triggerRestTimer, weightUnit }: SetRowProps) {
  const { colors, isDark } = useTheme();
  const [focusedField, setFocusedField] = useState<'weight' | 'reps' | null>(null);
  const scale = useSharedValue(1);

  const checkAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleToggleCompleted = () => {
    const nextCompleted = !set.isCompleted;
    scale.value = withSpring(0.85, { damping: 10, stiffness: 300 }, (finished) => {
      if (finished) {
        scale.value = withSpring(1, { damping: 10, stiffness: 300 });
      }
    });
    updateSetLog(exIdx, setIdx, { isCompleted: nextCompleted });
    if (nextCompleted) {
      triggerRestTimer(90); // Default 90s rest
    }
  };

  return (
    <View
      className="flex-row items-center py-3 px-3.5 border mb-2"
      style={{
        borderRadius: 14,
        backgroundColor: set.isCompleted 
          ? 'rgba(234, 88, 12, 0.08)' 
          : (isDark ? 'rgba(255, 255, 255, 0.02)' : '#f4f4f5'),
        borderColor: set.isCompleted 
          ? 'rgba(234, 88, 12, 0.3)' 
          : (isDark ? 'rgba(255, 255, 255, 0.06)' : '#e4e4e7'),
      }}
    >
      {/* Set Number */}
      <Text
        className={`w-8 text-sm font-bold ${set.isCompleted ? 'text-[#ea580c]' : 'text-zinc-500'}`}
        style={{ fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }}
      >
        {String(setIdx + 1).padStart(2, '0')}
      </Text>

      {/* Weight Input */}
      <View className="flex-1 px-1.5">
        <TextInput
          keyboardType="numeric"
          className={`text-center text-sm py-3 font-bold h-12 border ${
            isDark ? 'bg-zinc-900/40 text-[#e2e2e5]' : 'bg-white text-zinc-900'
          }`}
          style={{
            borderRadius: 10,
            borderColor: focusedField === 'weight' 
              ? '#ea580c' 
              : (isDark ? 'rgba(255, 255, 255, 0.06)' : '#cbd5e1'),
          }}
          value={set.weight}
          onChangeText={(text) => updateSetLog(exIdx, setIdx, { weight: text })}
          placeholder="0"
          placeholderTextColor={isDark ? '#444448' : '#a1a1aa'}
          selectTextOnFocus
          onFocus={() => setFocusedField('weight')}
          onBlur={() => setFocusedField(null)}
        />
      </View>

      {/* Reps Input */}
      <View className="flex-1 px-1.5">
        <TextInput
          keyboardType="number-pad"
          className={`text-center text-sm py-3 font-bold h-12 border ${
            isDark ? 'bg-zinc-900/40 text-[#e2e2e5]' : 'bg-white text-zinc-900'
          }`}
          style={{
            borderRadius: 10,
            borderColor: focusedField === 'reps' 
              ? '#ea580c' 
              : (isDark ? 'rgba(255, 255, 255, 0.06)' : '#cbd5e1'),
          }}
          value={set.reps}
          onChangeText={(text) => updateSetLog(exIdx, setIdx, { reps: text })}
          placeholder="0"
          placeholderTextColor={isDark ? '#444448' : '#a1a1aa'}
          selectTextOnFocus
          onFocus={() => setFocusedField('reps')}
          onBlur={() => setFocusedField(null)}
        />
      </View>

      {/* Done Checkbox */}
      <View className="w-12 items-end">
        <Pressable onPress={handleToggleCompleted}>
          <Animated.View
            style={[
              checkAnimatedStyle,
              {
                width: 32,
                height: 32,
                borderRadius: 8,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: set.isCompleted 
                  ? '#ea580c' 
                  : (isDark ? 'rgba(255, 255, 255, 0.04)' : '#e2e8f0'),
                borderWidth: 1,
                borderColor: set.isCompleted 
                  ? '#ea580c' 
                  : (isDark ? 'rgba(255, 255, 255, 0.12)' : '#cbd5e1'),
              },
            ]}
          >
            {set.isCompleted && <Check color="#ffffff" size={16} strokeWidth={3} />}
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}

export function ActiveWorkoutLogger() {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const { weightUnit } = useUnits();
  
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom;
  const floatingBottom = bottomInset > 0 ? bottomInset : 16;
  const loggerBottomPosition = floatingBottom + 62 + 12;

  // Premium adaptive theme tokens
  const themeCard = isDark ? 'bg-zinc-950/60 border-white/5' : 'bg-white border-zinc-200/80';
  const themeTextHeader = isDark ? 'text-[#e2e2e5]' : 'text-zinc-900';
  const themeTextSub = isDark ? 'text-zinc-400' : 'text-zinc-600';
  const themeInputText = isDark ? 'text-[#e2e2e5]' : 'text-zinc-900';
  const themeHeaderBg = isDark ? 'bg-zinc-950/60 border-white/5' : 'bg-zinc-100/90 border-zinc-200';
  const themeBorder = isDark ? 'border-white/5' : 'border-zinc-200/80';
  const themeDivider = isDark ? 'border-white/5' : 'border-zinc-200/60';

  const { 
    activeWorkout, 
    elapsedSeconds, 
    addExerciseToWorkout, 
    removeExerciseFromWorkout, 
    addSetToExercise, 
    removeSetFromExercise, 
    updateSetLog, 
    cancelWorkout, 
    finishWorkout,
    reorderExerciseInWorkout,
    updateExerciseNotes,
    loggerVisible,
    setLoggerVisible
  } = useWorkout();

  // Custom Exercise States
  const [customExercises, setCustomExercises] = useState<any[]>([]);
  const [showCustomExModal, setShowCustomExModal] = useState(false);
  const [customExName, setCustomExName] = useState('');
  const [customExMuscle, setCustomExMuscle] = useState('Chest');
  const [customExType, setCustomExType] = useState('Barbell');
  const [creatingCustomEx, setCreatingCustomEx] = useState(false);

  const [workoutNotes, setWorkoutNotes] = useState('');
  const [loggingWorkout, setLoggingWorkout] = useState(false);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [restSeconds, setRestSeconds] = useState(0);
  const [showRestTimer, setShowRestTimer] = useState(false);
  const restTimerRef = useRef<any>(null);

  const categories = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Biceps', 'Triceps', 'Core', 'Cardio'];
  const systemFont = Platform.OS === 'ios' ? 'System' : 'sans-serif';

  const fetchCustomExercises = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('exercises')
        .select('id, name, category, instructions, video_url, user_id')
        .eq('user_id', user.id);
      if (error) throw error;
      setCustomExercises(data || []);
    } catch (e) {
      console.error('Error fetching custom exercises:', e);
    }
  };

  const handleCreateCustomExercise = async () => {
    if (!customExName.trim() || !user) {
      Alert.alert('Error', 'Please enter an exercise name.');
      return;
    }
    setCreatingCustomEx(true);
    try {
      const customId = `custom-${Date.now()}`;
      const newEx = {
        id: customId,
        name: customExName.trim(),
        category: customExMuscle,
        instructions: [`type:${customExType.toLowerCase()}`],
        user_id: user.id
      };
      
      const { error } = await supabase
        .from('exercises')
        .insert(newEx);

      if (error) throw error;

      setCustomExercises((prev) => [...prev, newEx]);
      
      // Automatically add it to active workout session and close creator modal
      addExerciseToWorkout(newEx);
      setShowCustomExModal(false);
      setShowExerciseModal(false);
      Alert.alert('Success', 'Custom exercise created and added to workout.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create custom exercise.');
    } finally {
      setCreatingCustomEx(false);
    }
  };

  const getExerciseTypeLabel = (ex: any) => {
    if (ex.instructions && ex.instructions.length > 0) {
      const typeInst = ex.instructions.find((i: string) => i.startsWith('type:'));
      if (typeInst) {
        const type = typeInst.replace('type:', '');
        return type.charAt(0).toUpperCase() + type.slice(1);
      }
    }
    return '';
  };

  useEffect(() => {
    if (user && loggerVisible) {
      fetchCustomExercises();
    }
  }, [user, loggerVisible]);

  const triggerRestTimer = (seconds: number) => {
    if (restTimerRef.current) clearInterval(restTimerRef.current);
    setRestSeconds(seconds);
    setShowRestTimer(true);

    restTimerRef.current = setInterval(() => {
      setRestSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(restTimerRef.current);
          setShowRestTimer(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (restTimerRef.current) clearInterval(restTimerRef.current);
    };
  }, []);

  const handleCancelWorkout = () => {
    Alert.alert(
      'Cancel Workout?',
      'This will delete all progress in your current active workout.',
      [
        { text: 'Resume', style: 'cancel' },
        {
          text: 'Cancel Workout',
          style: 'destructive',
          onPress: () => {
            cancelWorkout();
            setWorkoutNotes('');
          },
        },
      ]
    );
  };

  const handleFinishWorkout = async () => {
    try {
      setLoggingWorkout(true);
      await finishWorkout(workoutNotes);
      setWorkoutNotes('');
      Alert.alert('Success', 'Workout logged successfully.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save workout.');
    } finally {
      setLoggingWorkout(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (!activeWorkout) return null;

  return (
    <>
      {/* 1. PERSISTENT BOTTOM BAR */}
      {!loggerVisible && (
        <View 
          className={`absolute left-4 right-4 border p-5 flex-row justify-between items-center ${isDark ? 'bg-zinc-950/90 border-[#ea580c]/30' : 'bg-white border-[#ea580c]/50'}`}
          style={{ bottom: loggerBottomPosition, borderRadius: 20, elevation: 10, zIndex: 99 }}
        >
          <View className="flex-1 pr-3">
            <View className="flex-row items-center gap-1.5">
              <Flame size={12} color="#ea580c" />
              <Text className="text-[#ea580c] font-bold text-xs uppercase tracking-wider">Workout in progress</Text>
            </View>
            <Text className={`font-semibold text-sm mt-1.5 ${themeTextHeader}`} numberOfLines={1}>
              {activeWorkout.name} • {formatTime(elapsedSeconds)}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setLoggerVisible(true)} className="bg-[#ea580c] px-5 py-3" style={{ borderRadius: 12 }}>
            <Text className="text-white font-bold text-xs uppercase tracking-wider">Resume</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 2. PERSISTENT REST TIMER */}
      {showRestTimer && (
        <View 
          className={`absolute top-14 left-4 right-4 border py-4 px-4.5 flex-row justify-between items-center z-50 ${isDark ? 'bg-zinc-950/90 border-[#ea580c]/20' : 'bg-white border-[#ea580c]/30'}`}
          style={{ borderRadius: 18, elevation: 8 }}
        >
          <View className="flex-row items-center gap-2">
            <Clock size={16} color="#ea580c" />
            <Text className="text-[#ea580c] font-bold text-sm uppercase tracking-wider">Rest: {formatTime(restSeconds)}</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <TouchableOpacity onPress={() => setRestSeconds((prev) => prev + 30)} className={`border px-4.5 py-2.5 ${isDark ? 'bg-zinc-900 border-white/5' : 'bg-zinc-100 border-zinc-200'}`} style={{ borderRadius: 10 }}>
              <Text className="text-[#ea580c] font-bold text-xs uppercase tracking-wider">+30s</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setRestSeconds(0); setShowRestTimer(false); }} className={`border px-4 py-2.5 ${isDark ? 'bg-red-950/30 border-red-500/20' : 'bg-red-50 border-red-200'}`} style={{ borderRadius: 10 }}>
              <X size={12} color="#ff453a" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 3. FULL SCREEN LOGGER MODAL */}
      <Modal visible={loggerVisible} animationType="slide" presentationStyle="fullScreen">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.dark }}>
          <BackgroundGlows />
          <View className={`flex-row justify-between items-center px-4 py-4 border-b ${themeBorder} ${themeHeaderBg}`}>
            <View>
              <Text className="text-zinc-500 text-[10px] font-semibold">Current Workout</Text>
              <Text className={`text-sm font-bold mt-1 ${themeTextHeader}`}>{activeWorkout?.name}</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <View className={`px-3 py-1.5 border ${themeBorder} ${isDark ? 'bg-zinc-900/80' : 'bg-zinc-100'}`} style={{ borderRadius: 100 }}>
                <Text className="text-[#ea580c] font-bold text-xs">{formatTime(elapsedSeconds)}</Text>
              </View>
              <TouchableOpacity onPress={handleCancelWorkout} className={`px-3.5 py-1.5 border ${isDark ? 'border-red-500/20 bg-red-950/10' : 'border-red-200 bg-red-50'}`} style={{ borderRadius: 100 }}>
                <Text className="text-[#ff453a] text-xs font-semibold">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView 
            style={{ flex: 1, backgroundColor: 'transparent' }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 60 }}
          >
            <View className={`border p-3.5 mb-6 ${themeCard}`} style={{ borderRadius: 18 }}>
              <View className="flex-row items-center gap-1.5 mb-1">
                <FileText size={11} color="#71717a" />
                <Text className="text-[10px] font-bold text-zinc-500 uppercase">Workout Notes</Text>
              </View>
              <TextInput 
                className={`text-xs h-12 ${themeInputText}`} 
                placeholder="Add notes..." 
                placeholderTextColor={isDark ? '#5c5c61' : '#a1a1aa'} 
                value={workoutNotes} 
                onChangeText={setWorkoutNotes} 
                multiline 
              />
            </View>

            {activeWorkout?.exercises.length === 0 ? (
              <View className={`py-16 items-center justify-center gap-3 border border-dashed ${themeBorder}`} style={{ borderRadius: 24 }}>
                <Dumbbell size={28} color="#5c5c61" />
                <Text className={`font-bold text-sm ${themeTextSub}`}>No exercises added</Text>
              </View>
            ) : (
              activeWorkout?.exercises.map((ex, exIdx) => (
                <View key={ex.id + exIdx} className={`border p-4 mb-6 ${themeCard}`} style={{ borderRadius: 24 }}>
                  <View className={`flex-row justify-between items-center mb-3 pb-2.5 border-b ${themeDivider}`}>
                    <View className="flex-1 pr-2">
                      <Text className={`font-bold text-sm uppercase ${themeTextHeader}`}>{ex.name}</Text>
                      <Text className="text-[#ea580c] text-[9px] uppercase font-bold mt-0.5">
                        {ex.category}{getExerciseTypeLabel(ex) ? ` • ${getExerciseTypeLabel(ex)}` : ''}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-1.5 mr-2">
                      {exIdx > 0 && (
                        <TouchableOpacity
                          onPress={() => reorderExerciseInWorkout(exIdx, exIdx - 1)}
                          style={{
                            padding: 6,
                            borderWidth: 1,
                            borderRadius: 8,
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#e4e4e7',
                            backgroundColor: isDark ? 'rgba(24, 24, 27, 0.5)' : '#f4f4f5'
                          }}
                        >
                          <ChevronUp size={12} color="#ea580c" strokeWidth={2.5} />
                        </TouchableOpacity>
                      )}
                      {exIdx < activeWorkout.exercises.length - 1 && (
                        <TouchableOpacity
                          onPress={() => reorderExerciseInWorkout(exIdx, exIdx + 1)}
                          style={{
                            padding: 6,
                            borderWidth: 1,
                            borderRadius: 8,
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#e4e4e7',
                            backgroundColor: isDark ? 'rgba(24, 24, 27, 0.5)' : '#f4f4f5'
                          }}
                        >
                          <ChevronDown size={12} color="#ea580c" strokeWidth={2.5} />
                        </TouchableOpacity>
                      )}
                    </View>
                    <TouchableOpacity onPress={() => removeExerciseFromWorkout(exIdx)} className={`px-3 py-1.5 border ${isDark ? 'bg-red-950/10 border-red-500/20' : 'bg-red-50 border-red-200'}`} style={{ borderRadius: 100 }}>
                      <Text className="text-[#ff453a] font-bold text-[9px] uppercase">Remove</Text>
                    </TouchableOpacity>
                  </View>
                  
                  {/* Exercise Note Input */}
                  <View 
                    className="mb-3.5 px-1"
                    style={{
                      borderBottomWidth: 1,
                      borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#e4e4e7',
                      paddingBottom: 8,
                    }}
                  >
                    <TextInput
                      placeholder="Add exercise notes (e.g., tempo, cues)..."
                      placeholderTextColor={isDark ? '#444448' : '#a1a1aa'}
                      className={`text-xs py-1 ${themeInputText}`}
                      value={ex.notes || ''}
                      onChangeText={(text) => updateExerciseNotes(exIdx, text)}
                      style={{ fontFamily: systemFont }}
                    />
                  </View>

                  {ex.sets.map((set, setIdx) => (
                    <SetRow 
                      key={setIdx} 
                      set={set} 
                      setIdx={setIdx} 
                      exIdx={exIdx} 
                      updateSetLog={updateSetLog} 
                      triggerRestTimer={triggerRestTimer} 
                      weightUnit={weightUnit} 
                    />
                  ))}
                  
                  <View className={`flex-row justify-between items-center mt-3.5 pt-3 border-t ${themeDivider}`}>
                    <TouchableOpacity onPress={() => addSetToExercise(exIdx)} className="border border-[#ea580c]/30 bg-[#ea580c]/5 py-2.5 px-5" style={{ borderRadius: 100 }}>
                      <Text className="text-[#ea580c] text-xs font-bold uppercase">+ Add Set</Text>
                    </TouchableOpacity>
                    {ex.sets.length > 1 && (
                      <TouchableOpacity onPress={() => removeSetFromExercise(exIdx, ex.sets.length - 1)} className={`border py-2.5 px-5 ${isDark ? 'bg-zinc-900 border-white/5' : 'bg-zinc-100 border-zinc-200'}`} style={{ borderRadius: 100 }}>
                        <Text className={`text-xs font-bold uppercase ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>- Del Set</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
            )}
            
            <TouchableOpacity 
              onPress={() => { setSearchQuery(''); setSelectedCategory('All'); setShowExerciseModal(true); }} 
              className={`border border-dashed py-4 items-center justify-center flex-row gap-2 mb-16 ${themeCard}`} 
              style={{ borderRadius: 20 }}
            >
              <Plus color="#ea580c" size={14} />
              <Text className="text-[#ea580c] font-bold text-xs uppercase">Add Exercise</Text>
            </TouchableOpacity>
          </ScrollView>

          <View className={`px-4 py-4 border-t flex-row gap-4 ${themeBorder} ${themeHeaderBg}`}>
            <TouchableOpacity 
              onPress={() => setLoggerVisible(false)} 
              style={{
                flex: 1,
                borderWidth: 1,
                paddingVertical: 14,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 16,
                backgroundColor: isDark ? 'rgba(24, 24, 27, 0.8)' : '#f4f4f5',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#e4e4e7'
              }}
            >
              <Text className={isDark ? 'text-zinc-400 font-semibold' : 'text-zinc-600 font-semibold'}>Minimize</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={handleFinishWorkout} 
              disabled={loggingWorkout} 
              style={{
                flex: 1,
                backgroundColor: '#ea580c',
                paddingVertical: 14,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 16
              }}
            >
              {loggingWorkout ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold">Finish Workout</Text>}
            </TouchableOpacity>
          </View>

          {/* EXERCISE SELECTOR OVERLAY */}
          {showExerciseModal && (
            <View 
              style={{ 
                position: 'absolute', 
                top: 0, 
                bottom: 0, 
                left: 0, 
                right: 0, 
                zIndex: 50, 
                backgroundColor: colors.dark 
              }}
            >
              <SafeAreaView style={{ flex: 1 }}>
                <BackgroundGlows />
                <View className={`flex-row justify-between items-center px-4 py-4 border-b ${themeBorder} ${themeHeaderBg}`}>
                  <Text className={`text-sm font-bold ${themeTextHeader}`}>Add Exercise</Text>
                  <TouchableOpacity onPress={() => setShowExerciseModal(false)} style={{ padding: 6, borderWidth: 1, borderRadius: 100, borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#e4e4e7', backgroundColor: isDark ? 'rgba(24, 24, 27, 0.8)' : '#f4f4f5' }}><X size={14} color="#71717a" /></TouchableOpacity>
                </View>
                <View className={`px-4 py-3 border-b ${themeBorder} ${isDark ? 'bg-zinc-950/40' : 'bg-zinc-50'}`}><TextInput className={`text-sm h-8 ${themeInputText}`} placeholder="Search..." placeholderTextColor={isDark ? '#5c5c61' : '#a1a1aa'} value={searchQuery} onChangeText={setSearchQuery} /></View>
                
                {/* Create Custom Exercise Trigger Button */}
                <TouchableOpacity 
                  onPress={() => {
                    setCustomExName('');
                    setCustomExMuscle('Chest');
                    setCustomExType('Barbell');
                    setShowCustomExModal(true);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 12,
                    backgroundColor: isDark ? 'rgba(234, 88, 12, 0.1)' : 'rgba(234, 88, 12, 0.05)',
                    borderBottomWidth: 1,
                    borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#e4e4e7'
                  }}
                >
                  <Plus size={14} color="#ea580c" style={{ marginRight: 6 }} />
                  <Text className="text-[#ea580c] font-bold text-xs uppercase tracking-wider">Create Custom Exercise</Text>
                </TouchableOpacity>

                <View className={`py-3 border-b ${themeBorder} ${isDark ? 'bg-zinc-950/20' : 'bg-zinc-100/30'}`}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4">
                    {categories.map((cat) => (
                      <TouchableOpacity key={cat} onPress={() => setSelectedCategory(cat)} className="px-4 py-2 mr-2 border" style={{ borderRadius: 100, backgroundColor: selectedCategory === cat ? '#ea580c' : (isDark ? 'rgba(255, 255, 255, 0.02)' : '#ffffff'), borderColor: selectedCategory === cat ? '#ea580c' : (isDark ? 'rgba(255, 255, 255, 0.08)' : '#e4e4e7') }}>
                        <Text className="text-[10px] font-bold uppercase" style={{ color: selectedCategory === cat ? '#ffffff' : '#8e8e93' }}>{cat}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                
                <ScrollView className="flex-1 px-4 pt-3">
                  {(() => {
                    const merged = [...exercisesData];
                    customExercises.forEach((ce) => {
                      if (!merged.some((me) => me.id === ce.id)) {
                        merged.push(ce);
                      }
                    });
                    
                    const filtered = merged.filter((ex) => {
                      const matchesSearch = ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        ex.category.toLowerCase().includes(searchQuery.toLowerCase());
                      const matchesCategory = selectedCategory === 'All' || ex.category === selectedCategory;
                      return matchesSearch && matchesCategory;
                    });

                    if (filtered.length === 0) {
                      return (
                        <View className="py-16 items-center justify-center">
                          <Text className="text-zinc-500 text-sm font-bold uppercase tracking-wider">No Matching Records</Text>
                        </View>
                      );
                    }

                    return filtered.map((ex) => (
                      <TouchableOpacity key={ex.id} onPress={() => { addExerciseToWorkout(ex); setShowExerciseModal(false); }} className={`border p-4 mb-3 flex-row justify-between items-center ${themeCard}`} style={{ borderRadius: 18 }}>
                        <View className="flex-1 pr-2"><Text className={`font-semibold text-sm ${themeTextHeader}`}>{ex.name}</Text><Text className="text-[#ea580c] text-[10px] font-semibold mt-1">{ex.category}{getExerciseTypeLabel(ex) ? ` • ${getExerciseTypeLabel(ex)}` : ''}</Text></View>
                        <View className={`w-7 h-7 border items-center justify-center ${isDark ? 'bg-zinc-900/80' : 'bg-zinc-100'}`} style={{ borderRadius: 100 }}><Plus color="#ea580c" size={14} /></View>
                      </TouchableOpacity>
                    ));
                  })()}
                </ScrollView>

                {/* CREATE CUSTOM EXERCISE OVERLAY */}
                {showCustomExModal && (
                  <View 
                    style={{ 
                      position: 'absolute', 
                      top: 0, 
                      bottom: 0, 
                      left: 0, 
                      right: 0, 
                      zIndex: 60, 
                      backgroundColor: 'rgba(0, 0, 0, 0.82)',
                      justifyContent: 'center',
                      alignItems: 'center',
                      paddingHorizontal: 24
                    }}
                  >
                    <View 
                      style={{
                        borderWidth: 1,
                        padding: 24,
                        width: '100%',
                        borderRadius: 24,
                        backgroundColor: isDark ? '#0d0d11' : '#ffffff',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e4e4e7',
                        elevation: 8,
                      }}
                    >
                      <View className="flex-row justify-between items-center mb-5">
                        <Text className={`text-sm font-bold uppercase tracking-wider ${themeTextHeader}`}>
                          New Custom Exercise
                        </Text>
                        <TouchableOpacity 
                          onPress={() => setShowCustomExModal(false)} 
                          style={{ 
                            padding: 6,
                            borderWidth: 1,
                            borderRadius: 100,
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#e4e4e7',
                            backgroundColor: isDark ? 'rgba(24, 24, 27, 0.8)' : '#f4f4f5'
                          }}
                        >
                          <X size={12} color="#71717a" strokeWidth={2} />
                        </TouchableOpacity>
                      </View>

                      {/* Name Input */}
                      <Text className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Exercise Name</Text>
                      <View 
                        style={{
                          borderWidth: 1,
                          padding: 2,
                          marginBottom: 16,
                          backgroundColor: isDark ? 'rgba(24, 24, 27, 0.4)' : '#f4f4f5',
                          borderRadius: 14,
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#cbd5e1',
                        }}
                      >
                        <TextInput
                          className={`px-4 py-3 text-sm h-11 ${themeInputText}`}
                          placeholder="e.g., Kettlebell Swing"
                          placeholderTextColor={isDark ? '#5c5c61' : '#a1a1aa'}
                          value={customExName}
                          onChangeText={setCustomExName}
                          autoCapitalize="words"
                        />
                      </View>

                      {/* Target Muscle Group Dropdown/Select presets */}
                      <Text className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Target Muscle Group</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                        {categories.filter(c => c !== 'All').map((cat) => (
                          <TouchableOpacity
                            key={cat}
                            onPress={() => setCustomExMuscle(cat)}
                            style={{ 
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                              marginRight: 6,
                              borderWidth: 1,
                              borderRadius: 100,
                              backgroundColor: customExMuscle === cat ? '#ea580c' : (isDark ? 'rgba(255, 255, 255, 0.02)' : '#ffffff'),
                              borderColor: customExMuscle === cat ? '#ea580c' : (isDark ? 'rgba(255, 255, 255, 0.08)' : '#cbd5e1')
                            }}
                          >
                            <Text 
                              className="text-[9px] font-bold uppercase tracking-wider"
                              style={{ color: customExMuscle === cat ? '#ffffff' : '#8e8e93' }}
                            >
                              {cat}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>

                      {/* Exercise Type presets */}
                      <Text className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Exercise Type</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
                        {['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Kettlebell', 'Band', 'Weighted Bodyweight', 'Assisted Bodyweight', 'Reps', 'Duration', 'Distance', 'Other'].map((type) => (
                          <TouchableOpacity
                            key={type}
                            onPress={() => setCustomExType(type)}
                            style={{ 
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                              marginRight: 6,
                              borderWidth: 1,
                              borderRadius: 100,
                              backgroundColor: customExType === type ? '#ea580c' : (isDark ? 'rgba(255, 255, 255, 0.02)' : '#ffffff'),
                              borderColor: customExType === type ? '#ea580c' : (isDark ? 'rgba(255, 255, 255, 0.08)' : '#cbd5e1')
                            }}
                          >
                            <Text 
                              className="text-[9px] font-bold uppercase tracking-wider"
                              style={{ color: customExType === type ? '#ffffff' : '#8e8e93' }}
                            >
                              {type}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>

                      {/* Create Button */}
                      <TouchableOpacity
                        onPress={handleCreateCustomExercise}
                        disabled={creatingCustomEx}
                        className="w-full py-3.5 bg-[#ea580c] items-center justify-center"
                        style={{ borderRadius: 14 }}
                      >
                        {creatingCustomEx ? (
                          <ActivityIndicator color="#ffffff" />
                        ) : (
                          <Text className="text-white font-bold text-xs uppercase tracking-wider">
                            Create & Add Exercise
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </SafeAreaView>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </>
  );
}

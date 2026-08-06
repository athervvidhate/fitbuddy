import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  Keyboard,
} from 'react-native';

import { useAuth } from '../context/AuthContext';
import { useWorkout } from '../context/WorkoutContext';
import { supabase } from '../lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import exercisesData from '../data/exercises.json';
import { BackgroundGlows } from './background-glows';
import { Button, Card, Chip, Input, NumericInput, Sheet, Text } from './ui';
import { useThemeTokens } from '../theme/useThemeTokens';
import {
  Flame,
  Clock,
  Plus,
  Check,
  X,
  Dumbbell,
  ChevronUp,
  ChevronDown,
} from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

const categories = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Biceps', 'Triceps', 'Core', 'Cardio'];
const customExerciseTypes = [
  'Barbell', 'Dumbbell', 'Machine', 'Cable', 'Kettlebell', 'Band',
  'Weighted Bodyweight', 'Assisted Bodyweight', 'Reps', 'Duration', 'Distance', 'Other',
];

const DEFAULT_REST_SECONDS = 90;

// Isolated Set Row so per-keystroke edits and the check micro-animation don't re-render siblings.
interface SetRowProps {
  set: any;
  setIdx: number;
  exIdx: number;
  updateSetLog: (exIdx: number, setIdx: number, fields: any) => void;
  triggerRestTimer: (seconds: number) => void;
}

function SetRow({ set, setIdx, exIdx, updateSetLog, triggerRestTimer }: SetRowProps) {
  const t = useThemeTokens();
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
      triggerRestTimer(DEFAULT_REST_SECONDS);
    }
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.sm,
        paddingVertical: t.spacing.sm,
        paddingHorizontal: t.spacing.md,
        marginBottom: t.spacing.sm,
        borderRadius: t.radius.md,
        borderWidth: 1,
        backgroundColor: set.isCompleted ? t.color.accentSoft : t.color.surfaceRaised,
        borderColor: set.isCompleted ? t.color.accent : t.color.border,
      }}
    >
      <Text
        variant="label"
        color={set.isCompleted ? 'accent' : 'textTertiary'}
        tabular
        style={{ width: 26 }}
      >
        {String(setIdx + 1).padStart(2, '0')}
      </Text>

      <View style={{ flex: 1 }}>
        <NumericInput
          placeholder={set.placeholderWeight || '0'}
          value={set.weight}
          onChangeText={(val) => updateSetLog(exIdx, setIdx, { weight: val })}
          style={{ height: 44 }}
        />
      </View>

      <View style={{ flex: 1 }}>
        <NumericInput
          placeholder={set.placeholderReps || '10'}
          value={set.reps}
          onChangeText={(val) => updateSetLog(exIdx, setIdx, { reps: val })}
          style={{ height: 44 }}
        />
      </View>

      <Pressable onPress={handleToggleCompleted} hitSlop={8}>
        <Animated.View
          style={[
            checkAnimatedStyle,
            {
              width: 36,
              height: 36,
              borderRadius: t.radius.sm,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              backgroundColor: set.isCompleted ? t.color.accent : t.color.surface,
              borderColor: set.isCompleted ? t.color.accent : t.color.border,
            },
          ]}
        >
          {set.isCompleted && <Check color={t.color.onAccent} size={18} strokeWidth={3} />}
        </Animated.View>
      </Pressable>
    </View>
  );
}

/** Column captions above each exercise's sets, aligned to the SetRow layout. */
function SetHeaderRow() {
  const t = useThemeTokens();
  const cell = { textAlign: 'center' as const };
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.sm,
        paddingHorizontal: t.spacing.md,
        marginBottom: t.spacing.xs,
      }}
    >
      <Text variant="caption" color="textTertiary" style={{ width: 26 }}>
        Set
      </Text>
      <Text variant="caption" color="textTertiary" style={[{ flex: 1 }, cell]}>
        Weight
      </Text>
      <Text variant="caption" color="textTertiary" style={[{ flex: 1 }, cell]}>
        Reps
      </Text>
      <View style={{ width: 36 }} />
    </View>
  );
}

export function ActiveWorkoutLogger() {
  const { user } = useAuth();
  const t = useThemeTokens();

  const restEndTimeRef = useRef<number>(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardVisible(true);
        setKeyboardHeight(e.endCoordinates?.height || 0);
      }
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
        setKeyboardHeight(0);
      }
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const insets = useSafeAreaInsets();
  const floatingBottom = insets.bottom > 0 ? insets.bottom : t.spacing.lg;
  // Sits above the floating tab bar (62 + 16 gap), matching Screen's inset geometry.
  const loggerBottomPosition = floatingBottom + 62 + t.spacing.md;

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
    setLoggerVisible,
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

  // Merge + filter the exercise catalogue once per input change rather than on every render.
  const mergedExercises = useMemo(() => {
    const merged: any[] = [...exercisesData];
    customExercises.forEach((ce) => {
      if (!merged.some((me) => me.id === ce.id)) {
        merged.push(ce);
      }
    });
    return merged;
  }, [customExercises]);

  const filteredExercises = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return mergedExercises.filter((ex) => {
      const matchesSearch =
        ex.name.toLowerCase().includes(query) || ex.category.toLowerCase().includes(query);
      const matchesCategory = selectedCategory === 'All' || ex.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [mergedExercises, searchQuery, selectedCategory]);

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
        user_id: user.id,
      };

      const { error } = await supabase.from('exercises').insert(newEx);

      if (error) throw error;

      setCustomExercises((prev) => [...prev, newEx]);

      // Automatically add it to active workout session and close both overlays
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
    const endTime = new Date().getTime() + seconds * 1000;
    restEndTimeRef.current = endTime;
    setRestSeconds(seconds);
    setShowRestTimer(true);

    restTimerRef.current = setInterval(() => {
      const now = new Date().getTime();
      const remaining = Math.max(0, Math.ceil((restEndTimeRef.current - now) / 1000));
      setRestSeconds(remaining);
      if (remaining <= 0) {
        clearInterval(restTimerRef.current);
        setShowRestTimer(false);
      }
    }, 1000);
  };

  const handleExtendRest = () => {
    restEndTimeRef.current += 30 * 1000;
    setRestSeconds((prev) => prev + 30);
  };

  const handleCancelRest = () => {
    if (restTimerRef.current) clearInterval(restTimerRef.current);
    setRestSeconds(0);
    setShowRestTimer(false);
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

  // Rolls into hours past 60 minutes. Without this an abandoned draft renders its age as raw
  // minutes — a draft left since December displayed as "53392:44".
  const formatTime = (seconds: number) => {
    const safe = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(safe / 3600);
    const mins = Math.floor((safe % 3600) / 60);
    const secs = safe % 60;
    const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
    return hours > 0 ? `${hours}:${pad(mins)}:${pad(secs)}` : `${mins}:${pad(secs)}`;
  };

  const openExercisePicker = () => {
    setSearchQuery('');
    setSelectedCategory('All');
    setShowExerciseModal(true);
  };

  if (!activeWorkout) return null;

  return (
    <>
      {/* 1. PERSISTENT MINIMIZED BAR */}
      {!loggerVisible && (
        <Card
          elevation="raised"
          radius="xl"
          style={{
            position: 'absolute',
            left: t.spacing.lg,
            right: t.spacing.lg,
            bottom: loggerBottomPosition,
            borderColor: t.color.accent,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 99,
          }}
        >
          <View style={{ flex: 1, paddingRight: t.spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs }}>
              <Flame size={13} color={t.color.accent} />
              <Text variant="caption" color="accent">
                Workout in progress
              </Text>
            </View>
            <Text variant="bodyStrong" numberOfLines={1} style={{ marginTop: t.spacing.xs }} tabular>
              {activeWorkout.name} · {formatTime(elapsedSeconds)}
            </Text>
          </View>
          <Button label="Resume" size="sm" onPress={() => setLoggerVisible(true)} />
        </Card>
      )}

      {/* 2. PERSISTENT REST TIMER */}
      {showRestTimer && (
        <Card
          elevation="raised"
          radius="lg"
          padding="md"
          style={{
            position: 'absolute',
            top: insets.top + t.spacing.sm,
            left: t.spacing.lg,
            right: t.spacing.lg,
            borderColor: t.color.accent,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 100,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
            <Clock size={18} color={t.color.accent} />
            <Text variant="bodyStrong" color="accent" tabular>
              Rest · {formatTime(restSeconds)}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
            <Button label="+30s" size="sm" variant="secondary" onPress={handleExtendRest} />
            <TouchableOpacity
              onPress={handleCancelRest}
              hitSlop={8}
              style={{
                width: 36,
                height: 36,
                borderRadius: t.radius.sm,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: t.color.border,
                backgroundColor: t.color.surfaceRaised,
              }}
            >
              <X size={16} color={t.color.danger} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </Card>
      )}

      {/* 3. FULLSCREEN LOGGER — Sheet carries the delayed-unmount fix (ticket 02). */}
      <Sheet visible={loggerVisible} onRequestClose={() => setLoggerVisible(false)}>
        <BackgroundGlows />

        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: t.spacing.lg,
            paddingBottom: t.spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: t.color.borderSoft,
          }}
        >
          <View style={{ flex: 1, paddingRight: t.spacing.md }}>
            <Text variant="caption" color="textTertiary">
              Current workout
            </Text>
            <Text variant="heading" numberOfLines={1} style={{ marginTop: 2 }}>
              {activeWorkout?.name}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
            <View
              style={{
                paddingHorizontal: t.spacing.md,
                paddingVertical: t.spacing.xs,
                borderRadius: t.radius.pill,
                borderWidth: 1,
                borderColor: t.color.border,
                backgroundColor: t.color.surfaceRaised,
              }}
            >
              <Text variant="label" color="accent" tabular>
                {formatTime(elapsedSeconds)}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleCancelWorkout}
              style={{
                paddingHorizontal: t.spacing.md,
                paddingVertical: t.spacing.xs,
                borderRadius: t.radius.pill,
                borderWidth: 1,
                borderColor: t.color.danger,
              }}
            >
              <Text variant="label" color="danger">
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: t.spacing.lg,
            paddingTop: t.spacing.lg,
            paddingBottom: t.spacing.xxl,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <Input
            label="Workout notes"
            placeholder="Add notes…"
            value={workoutNotes}
            onChangeText={setWorkoutNotes}
            multiline
            containerStyle={{ marginBottom: t.spacing.xl }}
            style={{ height: 64, paddingTop: t.spacing.md, textAlignVertical: 'top' }}
          />

          {activeWorkout?.exercises.length === 0 ? (
            <Card
              bordered
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                gap: t.spacing.md,
                paddingVertical: t.spacing.xxxl,
                borderStyle: 'dashed',
                borderColor: t.color.border,
              }}
            >
              <Dumbbell size={28} color={t.color.textTertiary} />
              <Text variant="body" color="textSecondary">
                No exercises added
              </Text>
            </Card>
          ) : (
            activeWorkout?.exercises.map((ex, exIdx) => (
              <Card
                key={ex.id + exIdx}
                style={{ marginBottom: t.spacing.lg }}
              >
                {/* Exercise header */}
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: t.spacing.md,
                    paddingBottom: t.spacing.md,
                    borderBottomWidth: 1,
                    borderBottomColor: t.color.borderSoft,
                  }}
                >
                  <View style={{ flex: 1, paddingRight: t.spacing.sm }}>
                    <Text variant="bodyStrong" numberOfLines={2}>
                      {ex.name}
                    </Text>
                    <Text variant="caption" color="accent" style={{ marginTop: 2 }}>
                      {ex.category}
                      {getExerciseTypeLabel(ex) ? ` · ${getExerciseTypeLabel(ex)}` : ''}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs }}>
                    {exIdx > 0 && (
                      <TouchableOpacity
                        onPress={() => reorderExerciseInWorkout(exIdx, exIdx - 1)}
                        hitSlop={6}
                        style={{
                          padding: 6,
                          borderWidth: 1,
                          borderRadius: t.radius.sm,
                          borderColor: t.color.border,
                          backgroundColor: t.color.surfaceRaised,
                        }}
                      >
                        <ChevronUp size={14} color={t.color.accent} strokeWidth={2.5} />
                      </TouchableOpacity>
                    )}
                    {exIdx < activeWorkout.exercises.length - 1 && (
                      <TouchableOpacity
                        onPress={() => reorderExerciseInWorkout(exIdx, exIdx + 1)}
                        hitSlop={6}
                        style={{
                          padding: 6,
                          borderWidth: 1,
                          borderRadius: t.radius.sm,
                          borderColor: t.color.border,
                          backgroundColor: t.color.surfaceRaised,
                        }}
                      >
                        <ChevronDown size={14} color={t.color.accent} strokeWidth={2.5} />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={() => removeExerciseFromWorkout(exIdx)}
                      hitSlop={6}
                      style={{
                        paddingHorizontal: t.spacing.md,
                        paddingVertical: 6,
                        borderRadius: t.radius.pill,
                        borderWidth: 1,
                        borderColor: t.color.danger,
                      }}
                    >
                      <Text variant="caption" color="danger">
                        Remove
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Exercise notes */}
                <Input
                  placeholder="Add exercise notes (e.g. tempo, cues)…"
                  value={ex.notes || ''}
                  onChangeText={(text) => updateExerciseNotes(exIdx, text)}
                  containerStyle={{ marginBottom: t.spacing.md }}
                  style={{ height: 44 }}
                />

                <SetHeaderRow />

                {ex.sets.map((set, setIdx) => (
                  <SetRow
                    key={setIdx}
                    set={set}
                    setIdx={setIdx}
                    exIdx={exIdx}
                    updateSetLog={updateSetLog}
                    triggerRestTimer={triggerRestTimer}
                  />
                ))}

                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: t.spacing.sm,
                  }}
                >
                  <Button
                    label="Add set"
                    size="sm"
                    variant="ghost"
                    leading={<Plus size={16} color={t.color.accent} />}
                    onPress={() => addSetToExercise(exIdx)}
                  />
                  {ex.sets.length > 1 && (
                    <Button
                      label="Remove set"
                      size="sm"
                      variant="secondary"
                      onPress={() => removeSetFromExercise(exIdx, ex.sets.length - 1)}
                    />
                  )}
                </View>
              </Card>
            ))
          )}

          <TouchableOpacity
            onPress={openExercisePicker}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: t.spacing.sm,
              paddingVertical: t.spacing.lg,
              borderRadius: t.radius.xl,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: t.color.accent,
              backgroundColor: t.color.accentSoft,
            }}
          >
            <Plus color={t.color.accent} size={18} />
            <Text variant="bodyStrong" color="accent">
              Add exercise
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Footer */}
        <View
          style={{
            flexDirection: 'row',
            gap: t.spacing.md,
            paddingHorizontal: t.spacing.lg,
            paddingTop: t.spacing.md,
            // Sheet's SafeAreaView already clears the home indicator; adding insets.bottom here
            // too just doubled the gap.
            paddingBottom: t.spacing.md,
            borderTopWidth: 1,
            borderTopColor: t.color.borderSoft,
          }}
        >
          <Button
            label="Minimize"
            variant="secondary"
            fullWidth
            onPress={() => setLoggerVisible(false)}
          />
          <Button
            label="Finish workout"
            fullWidth
            loading={loggingWorkout}
            onPress={handleFinishWorkout}
          />
        </View>

        {/* Floating keyboard-dismiss button */}
        {keyboardVisible && (
          <TouchableOpacity
            onPress={() => Keyboard.dismiss()}
            activeOpacity={0.8}
            style={{
              position: 'absolute',
              bottom: Platform.OS === 'ios' ? keyboardHeight + t.spacing.lg : t.spacing.xl,
              right: t.spacing.xl,
              width: 48,
              height: 48,
              borderRadius: t.radius.pill,
              backgroundColor: t.color.accent,
              alignItems: 'center',
              justifyContent: 'center',
              ...t.elevation.overlay,
              zIndex: 9999,
            }}
          >
            <ChevronDown size={24} color={t.color.onAccent} strokeWidth={2.5} />
          </TouchableOpacity>
        )}
        {/* 4. EXERCISE SELECTOR — nested INSIDE the logger Sheet: iOS will not present a
            second Modal from a view controller that is already presenting one. */}
        <Sheet visible={showExerciseModal} onRequestClose={() => setShowExerciseModal(false)}>
          <BackgroundGlows />

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: t.spacing.lg,
              paddingBottom: t.spacing.md,
              borderBottomWidth: 1,
              borderBottomColor: t.color.borderSoft,
            }}
          >
            <Text variant="heading">Add exercise</Text>
            <TouchableOpacity
              onPress={() => setShowExerciseModal(false)}
              hitSlop={8}
              style={{
                padding: 8,
                borderRadius: t.radius.pill,
                borderWidth: 1,
                borderColor: t.color.border,
                backgroundColor: t.color.surfaceRaised,
              }}
            >
              <X size={16} color={t.color.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={{ paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.md }}>
            <Input
              placeholder="Search exercises…"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <View style={{ paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.md }}>
            <Button
              label="Create custom exercise"
              variant="secondary"
              fullWidth
              leading={<Plus size={16} color={t.color.textPrimary} />}
              onPress={() => {
                setCustomExName('');
                setCustomExMuscle('Chest');
                setCustomExType('Barbell');
                setShowCustomExModal(true);
              }}
            />
          </View>

          <View style={{ paddingVertical: t.spacing.md }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: t.spacing.lg, gap: t.spacing.sm }}
            >
              {categories.map((cat) => (
                <Chip
                  key={cat}
                  label={cat}
                  selected={selectedCategory === cat}
                  onPress={() => setSelectedCategory(cat)}
                />
              ))}
            </ScrollView>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: t.spacing.lg,
              paddingBottom: t.spacing.xxl,
            }}
            keyboardShouldPersistTaps="handled"
          >
            {filteredExercises.length === 0 ? (
              <View style={{ paddingVertical: t.spacing.xxxl, alignItems: 'center' }}>
                <Text variant="body" color="textTertiary">
                  No matching exercises
                </Text>
              </View>
            ) : (
              filteredExercises.map((ex) => (
                <TouchableOpacity
                  key={ex.id}
                  onPress={() => {
                    addExerciseToWorkout(ex);
                    setShowExerciseModal(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Card
                    style={{
                      marginBottom: t.spacing.md,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <View style={{ flex: 1, paddingRight: t.spacing.sm }}>
                      <Text variant="bodyStrong" numberOfLines={1}>
                        {ex.name}
                      </Text>
                      <Text variant="caption" color="accent" style={{ marginTop: 2 }}>
                        {ex.category}
                        {getExerciseTypeLabel(ex) ? ` · ${getExerciseTypeLabel(ex)}` : ''}
                      </Text>
                    </View>
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: t.radius.pill,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: t.color.accentSoft,
                      }}
                    >
                      <Plus color={t.color.accent} size={16} />
                    </View>
                  </Card>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>

          {/* CREATE CUSTOM EXERCISE — centered dialog over the selector. */}
          {showCustomExModal && (
            <View
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 60,
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                justifyContent: 'center',
                alignItems: 'center',
                paddingHorizontal: t.spacing.xl,
              }}
            >
              <Card elevation="raised" radius="xxl" padding="xl" style={{ width: '100%' }}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: t.spacing.lg,
                  }}
                >
                  <Text variant="heading">New custom exercise</Text>
                  <TouchableOpacity
                    onPress={() => setShowCustomExModal(false)}
                    hitSlop={8}
                    style={{
                      padding: 6,
                      borderRadius: t.radius.pill,
                      borderWidth: 1,
                      borderColor: t.color.border,
                      backgroundColor: t.color.surfaceRaised,
                    }}
                  >
                    <X size={14} color={t.color.textSecondary} strokeWidth={2} />
                  </TouchableOpacity>
                </View>

                <Input
                  label="Exercise name"
                  placeholder="e.g. Kettlebell Swing"
                  value={customExName}
                  onChangeText={setCustomExName}
                  autoCapitalize="words"
                  containerStyle={{ marginBottom: t.spacing.lg }}
                />

                <Text variant="label" color="textSecondary" style={{ marginBottom: t.spacing.sm }}>
                  Target muscle group
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: t.spacing.sm }}
                  style={{ marginBottom: t.spacing.lg }}
                >
                  {categories
                    .filter((c) => c !== 'All')
                    .map((cat) => (
                      <Chip
                        key={cat}
                        label={cat}
                        selected={customExMuscle === cat}
                        onPress={() => setCustomExMuscle(cat)}
                      />
                    ))}
                </ScrollView>

                <Text variant="label" color="textSecondary" style={{ marginBottom: t.spacing.sm }}>
                  Exercise type
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: t.spacing.sm }}
                  style={{ marginBottom: t.spacing.xl }}
                >
                  {customExerciseTypes.map((type) => (
                    <Chip
                      key={type}
                      label={type}
                      selected={customExType === type}
                      onPress={() => setCustomExType(type)}
                    />
                  ))}
                </ScrollView>

                <Button
                  label="Create & add exercise"
                  fullWidth
                  loading={creatingCustomEx}
                  onPress={handleCreateCustomExercise}
                />
              </Card>
            </View>
          )}
        </Sheet>
      </Sheet>
    </>
  );
}

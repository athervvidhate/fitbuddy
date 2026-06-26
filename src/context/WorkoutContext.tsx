import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useUnits } from './UnitContext';

export type SetLog = {
  reps: string; // Keep as string for text inputs
  weight: string; // Keep as string for text inputs
  isCompleted: boolean;
  notes: string;
  placeholderWeight?: string;
  placeholderReps?: string;
};

export type ExerciseLog = {
  id: string;
  name: string;
  category: string;
  sets: SetLog[];
  notes?: string;
};

export type ActiveWorkout = {
  name: string;
  routineId: string | null;
  startedAt: string;
  exercises: ExerciseLog[];
};

type WorkoutContextType = {
  activeWorkout: ActiveWorkout | null;
  elapsedSeconds: number;
  keepAwakeEnabled: boolean;
  isLoadingDraft: boolean;
  loggerVisible: boolean;
  setLoggerVisible: (visible: boolean) => void;
  startWorkout: (name: string, routineId?: string | null, exercises?: ExerciseLog[]) => void;
  addExerciseToWorkout: (exercise: { id: string; name: string; category: string }) => void;
  removeExerciseFromWorkout: (exerciseIndex: number) => void;
  addSetToExercise: (exerciseIndex: number) => void;
  removeSetFromExercise: (exerciseIndex: number, setIndex: number) => void;
  updateSetLog: (exerciseIndex: number, setIndex: number, fields: Partial<SetLog>) => void;
  cancelWorkout: () => void;
  finishWorkout: (notes?: string) => Promise<void>;
  setKeepAwakeEnabled: (enabled: boolean) => Promise<void>;
  reorderExerciseInWorkout: (fromIndex: number, toIndex: number) => void;
  updateExerciseNotes: (exerciseIndex: number, notes: string) => void;
};

const WorkoutContext = createContext<WorkoutContextType | undefined>(undefined);

const DRAFT_WORKOUT_KEY = '@fitbuddy_active_workout_draft';
const KEEP_AWAKE_KEY = '@fitbuddy_keep_awake_setting';
const OFFLINE_WORKOUTS_KEY = '@fitbuddy_offline_workouts';

export const WorkoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { parseWeightInput, displayWeightValue, weightUnit } = useUnits();

  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [keepAwakeEnabled, setKeepAwakeState] = useState(false);
  const [isLoadingDraft, setIsLoadingDraft] = useState(true);
  const [loggerVisible, setLoggerVisible] = useState(false);

  // Cache user's last recorded sets for all exercises
  const [lastRecorded, setLastRecorded] = useState<Record<string, { weight: number; reps: number }[]>>({});

  const timerRef = useRef<any>(null);
  const saveDraftTimeoutRef = useRef<any>(null);

  // Load Keep Awake Preference & Active Workout Draft
  useEffect(() => {
    const loadSettingsAndDraft = async () => {
      try {
        const keepAwakeSetting = await AsyncStorage.getItem(KEEP_AWAKE_KEY);
        const isKeepAwake = keepAwakeSetting === 'true';
        setKeepAwakeState(isKeepAwake);

        const draftStr = await AsyncStorage.getItem(DRAFT_WORKOUT_KEY);
        if (draftStr) {
          const draft = JSON.parse(draftStr) as ActiveWorkout;
          setActiveWorkout(draft);
          
          // Calculate elapsed seconds based on startedAt
          const startTime = new Date(draft.startedAt).getTime();
          const now = new Date().getTime();
          const diffSeconds = Math.max(0, Math.floor((now - startTime) / 1000));
          setElapsedSeconds(diffSeconds);

          if (isKeepAwake) {
            activateKeepAwakeAsync();
          }
        }
      } catch (e) {
        console.error('Failed to load active workout draft', e);
      } finally {
        setIsLoadingDraft(false);
      }
    };
    loadSettingsAndDraft();
  }, []);

  // Fetch last recorded sets and sync offline workouts when user changes
  useEffect(() => {
    const initUserData = async () => {
      if (!user) return;
      await fetchLastRecordedValues();
      await syncOfflineWorkouts();
    };
    initUserData();
  }, [user]);

  const fetchLastRecordedValues = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('workouts')
        .select(`
          completed_at,
          workout_exercises (
            exercise_id,
            workout_sets (
              weight,
              reps,
              set_index,
              is_completed
            )
          )
        `)
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false });

      if (error) throw error;

      const map: Record<string, { weight: number; reps: number }[]> = {};
      
      data?.forEach((w: any) => {
        w.workout_exercises?.forEach((we: any) => {
          const exId = we.exercise_id;
          if (exId && !map[exId]) {
            const completedSets = (we.workout_sets || [])
              .filter((s: any) => s.is_completed)
              .sort((a: any, b: any) => a.set_index - b.set_index)
              .map((s: any) => ({
                weight: displayWeightValue(s.weight),
                reps: s.reps,
              }));
            
            if (completedSets.length > 0) {
              map[exId] = completedSets;
            }
          }
        });
      });

      setLastRecorded(map);
    } catch (e) {
      console.error('Failed to fetch last recorded sets:', e);
    }
  };

  const syncOfflineWorkouts = async () => {
    if (!user) return;
    try {
      const queueStr = await AsyncStorage.getItem(OFFLINE_WORKOUTS_KEY);
      if (!queueStr) return;

      const queue = JSON.parse(queueStr) as any[];
      if (queue.length === 0) return;

      console.log(`Syncing ${queue.length} offline workouts to Supabase...`);

      for (let k = 0; k < queue.length; k++) {
        const workout = queue[k];

        // 1. Insert Workout Header
        const { data: workoutData, error: wError } = await supabase
          .from('workouts')
          .insert({
            user_id: user.id,
            routine_id: workout.routineId,
            name: workout.name,
            started_at: workout.startedAt,
            completed_at: workout.completedAt,
            notes: workout.notes || '',
          })
          .select()
          .single();

        if (wError) throw wError;
        const workoutId = workoutData.id;

        // 2. Batch Insert Exercises
        const exercisesToInsert = workout.exercises.map((ex: any, idx: number) => ({
          workout_id: workoutId,
          exercise_id: ex.id,
          order_index: idx,
          notes: ex.notes || '',
        }));

        const { data: insertedExercises, error: exError } = await supabase
          .from('workout_exercises')
          .insert(exercisesToInsert)
          .select('id, exercise_id, order_index');

        if (exError) throw exError;

        // 3. Batch Insert Sets
        const setsToInsert: any[] = [];
        workout.exercises.forEach((ex: any, idx: number) => {
          const insertedEx = insertedExercises.find(
            (ie: any) => ie.exercise_id === ex.id && ie.order_index === idx
          );
          if (!insertedEx) return;

          ex.sets.forEach((set: any, setIdx: number) => {
            setsToInsert.push({
              workout_exercise_id: insertedEx.id,
              set_index: setIdx,
              reps: set.reps,
              weight: set.weight, // already in KG
              is_completed: true,
              notes: set.notes || '',
            });
          });
        });

        if (setsToInsert.length > 0) {
          const { error: setsError } = await supabase
            .from('workout_sets')
            .insert(setsToInsert);
          if (setsError) throw setsError;
        }
      }

      await AsyncStorage.removeItem(OFFLINE_WORKOUTS_KEY);
      console.log('Offline workouts synced successfully.');
    } catch (e) {
      console.error('Failed to sync offline workouts:', e);
    }
  };

  // Timer Effect: Calculate elapsed seconds from startedAt to prevent drift
  useEffect(() => {
    if (activeWorkout) {
      const startTime = new Date(activeWorkout.startedAt).getTime();
      const now = new Date().getTime();
      setElapsedSeconds(Math.max(0, Math.floor((now - startTime) / 1000)));

      timerRef.current = setInterval(() => {
        const tickNow = new Date().getTime();
        const diffSeconds = Math.max(0, Math.floor((tickNow - startTime) / 1000));
        setElapsedSeconds(diffSeconds);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setElapsedSeconds(0);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeWorkout]);

  // Keep Awake Activation Effect
  useEffect(() => {
    if (activeWorkout && keepAwakeEnabled) {
      activateKeepAwakeAsync();
    } else {
      deactivateKeepAwake();
    }
  }, [activeWorkout, keepAwakeEnabled]);

  // Persist Workout Draft with a debouncer to prevent UI input lag
  const saveDraft = (workout: ActiveWorkout | null) => {
    if (saveDraftTimeoutRef.current) {
      clearTimeout(saveDraftTimeoutRef.current);
    }

    if (workout === null) {
      AsyncStorage.removeItem(DRAFT_WORKOUT_KEY).catch((e) =>
        console.error('Failed to clear draft', e)
      );
      return;
    }

    // Debounce the disk write by 1000ms
    saveDraftTimeoutRef.current = setTimeout(async () => {
      try {
        await AsyncStorage.setItem(DRAFT_WORKOUT_KEY, JSON.stringify(workout));
      } catch (e) {
        console.error('Failed to save draft', e);
      }
    }, 1000);
  };

  const setKeepAwakeEnabled = async (enabled: boolean) => {
    setKeepAwakeState(enabled);
    try {
      await AsyncStorage.setItem(KEEP_AWAKE_KEY, String(enabled));
      if (activeWorkout && enabled) {
        await activateKeepAwakeAsync();
      } else {
        deactivateKeepAwake();
      }
    } catch (e) {
      console.error('Failed to save keep awake setting', e);
    }
  };

  const startWorkout = (name: string, routineId: string | null = null, exercises: ExerciseLog[] = []) => {
    const newWorkout: ActiveWorkout = {
      name,
      routineId,
      startedAt: new Date().toISOString(),
      exercises,
    };
    setActiveWorkout(newWorkout);
    setElapsedSeconds(0);
    setLoggerVisible(true);
    saveDraft(newWorkout);
  };

  const addExerciseToWorkout = (exercise: { id: string; name: string; category: string }) => {
    if (!activeWorkout) return;

    // Look up last recorded sets for this exercise to use as placeholders
    const prevSets = lastRecorded[exercise.id];
    const sets: SetLog[] = prevSets && prevSets.length > 0
      ? prevSets.map((ps) => ({
          reps: '',
          weight: '',
          isCompleted: false,
          notes: '',
          placeholderWeight: String(ps.weight),
          placeholderReps: String(ps.reps),
        }))
      : [{ reps: '', weight: '', isCompleted: false, notes: '', placeholderWeight: '0', placeholderReps: '10' }];

    const newExercise: ExerciseLog = {
      id: exercise.id,
      name: exercise.name,
      category: exercise.category,
      sets,
      notes: '',
    };

    const updated = {
      ...activeWorkout,
      exercises: [...activeWorkout.exercises, newExercise],
    };
    setActiveWorkout(updated);
    saveDraft(updated);
  };

  const removeExerciseFromWorkout = (exerciseIndex: number) => {
    if (!activeWorkout) return;

    const updatedExercises = activeWorkout.exercises.filter((_, i) => i !== exerciseIndex);
    const updated = {
      ...activeWorkout,
      exercises: updatedExercises,
    };
    setActiveWorkout(updated);
    saveDraft(updated);
  };

  const addSetToExercise = (exerciseIndex: number) => {
    if (!activeWorkout) return;

    const updatedExercises = [...activeWorkout.exercises];
    const targetExercise = updatedExercises[exerciseIndex];
    const lastSet = targetExercise.sets[targetExercise.sets.length - 1];

    const newSet: SetLog = lastSet
      ? {
          reps: '',
          weight: '',
          isCompleted: false,
          notes: '',
          placeholderWeight: lastSet.weight || lastSet.placeholderWeight || '0',
          placeholderReps: lastSet.reps || lastSet.placeholderReps || '10',
        }
      : { reps: '', weight: '', isCompleted: false, notes: '', placeholderWeight: '0', placeholderReps: '10' };

    targetExercise.sets = [...targetExercise.sets, newSet];
    const updated = { ...activeWorkout, exercises: updatedExercises };
    setActiveWorkout(updated);
    saveDraft(updated);
  };

  const removeSetFromExercise = (exerciseIndex: number, setIndex: number) => {
    if (!activeWorkout) return;

    const updatedExercises = [...activeWorkout.exercises];
    const targetExercise = updatedExercises[exerciseIndex];
    
    targetExercise.sets = targetExercise.sets.filter((_, i) => i !== setIndex);
    
    // Ensure there's always at least one set
    if (targetExercise.sets.length === 0) {
      targetExercise.sets = [{ reps: '', weight: '', isCompleted: false, notes: '', placeholderWeight: '0', placeholderReps: '10' }];
    }

    const updated = { ...activeWorkout, exercises: updatedExercises };
    setActiveWorkout(updated);
    saveDraft(updated);
  };

  const updateSetLog = (exerciseIndex: number, setIndex: number, fields: Partial<SetLog>) => {
    if (!activeWorkout) return;

    const updatedExercises = [...activeWorkout.exercises];
    const targetExercise = updatedExercises[exerciseIndex];
    targetExercise.sets[setIndex] = {
      ...targetExercise.sets[setIndex],
      ...fields,
    };

    const updated = { ...activeWorkout, exercises: updatedExercises };
    setActiveWorkout(updated);
    saveDraft(updated);
  };

  const cancelWorkout = () => {
    setActiveWorkout(null);
    setElapsedSeconds(0);
    setLoggerVisible(false);
    saveDraft(null);
  };

  const reorderExerciseInWorkout = (fromIndex: number, toIndex: number) => {
    if (!activeWorkout) return;
    if (fromIndex < 0 || fromIndex >= activeWorkout.exercises.length) return;
    if (toIndex < 0 || toIndex >= activeWorkout.exercises.length) return;

    const updatedExercises = [...activeWorkout.exercises];
    const element = updatedExercises[fromIndex];
    updatedExercises.splice(fromIndex, 1);
    updatedExercises.splice(toIndex, 0, element);

    const updated = {
      ...activeWorkout,
      exercises: updatedExercises,
    };
    setActiveWorkout(updated);
    saveDraft(updated);
  };

  const updateExerciseNotes = (exerciseIndex: number, notes: string) => {
    if (!activeWorkout) return;
    if (exerciseIndex < 0 || exerciseIndex >= activeWorkout.exercises.length) return;

    const updatedExercises = [...activeWorkout.exercises];
    updatedExercises[exerciseIndex] = {
      ...updatedExercises[exerciseIndex],
      notes,
    };

    const updated = {
      ...activeWorkout,
      exercises: updatedExercises,
    };
    setActiveWorkout(updated);
    saveDraft(updated);
  };

  const finishWorkout = async (notes = '') => {
    if (!activeWorkout || !user) return;

    // 1. Filter out exercises with 0 completed sets
    const exercisesToSave = activeWorkout.exercises.filter(
      (ex) => ex.sets.some((set) => set.isCompleted)
    );

    if (exercisesToSave.length === 0) {
      Alert.alert('No Progress Saved', 'No completed sets were found in this session. The workout has been cancelled.');
      cancelWorkout();
      return;
    }

    const completedAt = new Date().toISOString();

    try {
      // 1. Batch Insert Workout Header
      const { data: workoutData, error: workoutError } = await supabase
        .from('workouts')
        .insert({
          user_id: user.id,
          routine_id: activeWorkout.routineId,
          name: activeWorkout.name,
          started_at: activeWorkout.startedAt,
          completed_at: completedAt,
          notes: notes,
        })
        .select()
        .single();

      if (workoutError) throw workoutError;
      const workoutId = workoutData.id;

      // 2. Batch Insert All Workout Exercises in a single query
      const exercisesToInsert = exercisesToSave.map((ex, idx) => ({
        workout_id: workoutId,
        exercise_id: ex.id,
        order_index: idx,
        notes: ex.notes || '',
      }));

      const { data: insertedExercises, error: exError } = await supabase
        .from('workout_exercises')
        .insert(exercisesToInsert)
        .select('id, exercise_id, order_index');

      if (exError) throw exError;

      // 3. Batch Insert All Completed Sets for All Exercises in a single query
      const setsToInsert: any[] = [];
      exercisesToSave.forEach((ex, idx) => {
        const insertedEx = insertedExercises.find(
          (ie: any) => ie.exercise_id === ex.id && ie.order_index === idx
        );
        if (!insertedEx) return;

        const completedSets = ex.sets.filter((set) => set.isCompleted);
        completedSets.forEach((set, setIdx) => {
          // Fall back to gray placeholders if actual values are blank
          const rawWeight = parseFloat(set.weight) || parseFloat(set.placeholderWeight || '0') || 0;
          const rawReps = parseInt(set.reps) || parseInt(set.placeholderReps || '0') || 0;

          // Convert weight to metric (KG) for storage in database
          const weightInKg = parseWeightInput(rawWeight);

          setsToInsert.push({
            workout_exercise_id: insertedEx.id,
            set_index: setIdx,
            reps: rawReps,
            weight: weightInKg,
            is_completed: true,
            notes: set.notes || '',
          });
        });
      });

      if (setsToInsert.length > 0) {
        const { error: setsError } = await supabase
          .from('workout_sets')
          .insert(setsToInsert);

        if (setsError) throw setsError;
      }

      // Successful sync, clear active state and refresh cache
      cancelWorkout();
      fetchLastRecordedValues();
    } catch (e) {
      console.warn('Supabase sync failed, saving workout offline:', e);
      
      // Offline saving fallback
      try {
        const offlineWorkout = {
          routineId: activeWorkout.routineId,
          name: activeWorkout.name,
          startedAt: activeWorkout.startedAt,
          completedAt: completedAt,
          notes: notes,
          exercises: exercisesToSave.map((ex) => {
            const completedSets = ex.sets.filter((s) => s.isCompleted);
            return {
              id: ex.id,
              notes: ex.notes || '',
              sets: completedSets.map((set) => {
                const rawWeight = parseFloat(set.weight) || parseFloat(set.placeholderWeight || '0') || 0;
                const rawReps = parseInt(set.reps) || parseInt(set.placeholderReps || '0') || 0;
                const weightInKg = parseWeightInput(rawWeight);
                return {
                  reps: rawReps,
                  weight: weightInKg,
                  notes: set.notes || '',
                };
              }),
            };
          }),
        };

        const queueStr = await AsyncStorage.getItem(OFFLINE_WORKOUTS_KEY);
        const queue = queueStr ? JSON.parse(queueStr) : [];
        queue.push(offlineWorkout);
        await AsyncStorage.setItem(OFFLINE_WORKOUTS_KEY, JSON.stringify(queue));

        Alert.alert(
          'Offline Mode Enabled',
          'You are currently offline. Your workout has been saved locally on this device and will be automatically uploaded when your connection is restored.'
        );
        cancelWorkout();
      } catch (saveErr) {
        console.error('Failed to save workout offline:', saveErr);
        throw e; // Rethrow original error if offline save fails
      }
    }
  };

  return (
    <WorkoutContext.Provider
      value={{
        activeWorkout,
        elapsedSeconds,
        keepAwakeEnabled,
        isLoadingDraft,
        startWorkout,
        addExerciseToWorkout,
        removeExerciseFromWorkout,
        addSetToExercise,
        removeSetFromExercise,
        updateSetLog,
        cancelWorkout,
        finishWorkout,
        setKeepAwakeEnabled,
        reorderExerciseInWorkout,
        updateExerciseNotes,
        loggerVisible,
        setLoggerVisible,
      }}
    >
      {children}
    </WorkoutContext.Provider>
  );
};

export const useWorkout = () => {
  const context = useContext(WorkoutContext);
  if (!context) {
    throw new Error('useWorkout must be used within a WorkoutProvider');
  }
  return context;
};

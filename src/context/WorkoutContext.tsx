import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useUnits } from './UnitContext';

export type SetLog = {
  reps: string; // Keep as string for text inputs
  weight: string; // Keep as string for text inputs
  isCompleted: boolean;
  notes: string;
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

export const WorkoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { parseWeightInput, weightUnit } = useUnits();

  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [keepAwakeEnabled, setKeepAwakeState] = useState(false);
  const [isLoadingDraft, setIsLoadingDraft] = useState(true);
  const [loggerVisible, setLoggerVisible] = useState(false);

  const timerRef = useRef<any>(null);

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

  // Timer Effect
  useEffect(() => {
    if (activeWorkout) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
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

  // Persist Workout Draft whenever it changes
  const saveDraft = async (workout: ActiveWorkout | null) => {
    try {
      if (workout) {
        await AsyncStorage.setItem(DRAFT_WORKOUT_KEY, JSON.stringify(workout));
      } else {
        await AsyncStorage.removeItem(DRAFT_WORKOUT_KEY);
      }
    } catch (e) {
      console.error('Failed to save draft', e);
    }
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

    const newExercise: ExerciseLog = {
      id: exercise.id,
      name: exercise.name,
      category: exercise.category,
      sets: [{ reps: '10', weight: '0', isCompleted: false, notes: '' }],
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

    // Duplicate last set targets for quick progression
    const newSet: SetLog = lastSet
      ? { ...lastSet, isCompleted: false, notes: '' }
      : { reps: '10', weight: '0', isCompleted: false, notes: '' };

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
      targetExercise.sets = [{ reps: '10', weight: '0', isCompleted: false, notes: '' }];
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

    try {
      // 1. Insert Workout Header in Supabase
      const completedAt = new Date().toISOString();
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

      // 2. Insert Workout Exercises & Sets
      for (let i = 0; i < activeWorkout.exercises.length; i++) {
        const ex = activeWorkout.exercises[i];
        
        const { data: exData, error: exError } = await supabase
          .from('workout_exercises')
          .insert({
            workout_id: workoutId,
            exercise_id: ex.id,
            order_index: i,
            notes: ex.notes || '',
          })
          .select()
          .single();

        if (exError) throw exError;
        const workoutExerciseId = exData.id;

        // Save only completed sets (or save all but mark is_completed)
        const setsToInsert = ex.sets.map((set, setIdx) => {
          const rawWeight = parseFloat(set.weight) || 0;
          const rawReps = parseInt(set.reps) || 0;
          
          // CONVERT weight to metric (KG) for storage in database
          const weightInKg = parseWeightInput(rawWeight);

          return {
            workout_exercise_id: workoutExerciseId,
            set_index: setIdx,
            reps: rawReps,
            weight: weightInKg,
            is_completed: set.isCompleted,
            notes: set.notes,
          };
        });

        const { error: setsError } = await supabase
          .from('workout_sets')
          .insert(setsToInsert);

        if (setsError) throw setsError;
      }

      // Successful sync, clear active state
      cancelWorkout();
    } catch (e) {
      console.error('Failed to log workout to database', e);
      throw e;
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

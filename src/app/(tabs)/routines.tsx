import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useUnits } from '../../context/UnitContext';
import { useWorkout, ExerciseLog, SetLog } from '../../context/WorkoutContext';
import { supabase } from '../../lib/supabase';
import exercisesData from '../../data/exercises.json';
import { BackgroundGlows } from '../../components/background-glows';
import { Button, Card, Chip, Input, NumericInput, Screen, Sheet, Text } from '../../components/ui';
import { useThemeTokens } from '../../theme/useThemeTokens';
import {
  FolderPlus,
  Plus,
  Edit,
  Trash2,
  Dumbbell,
  X,
  AlertCircle,
  ChevronUp,
  ChevronDown,
} from 'lucide-react-native';

const categories = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Biceps', 'Triceps', 'Core', 'Cardio'];
const customExerciseTypes = [
  'Barbell', 'Dumbbell', 'Machine', 'Cable', 'Kettlebell', 'Band',
  'Weighted Bodyweight', 'Assisted Bodyweight', 'Reps', 'Duration', 'Distance', 'Other',
];

type FolderData = {
  id: string;
  name: string;
};

type RoutineExerciseData = {
  id: string;
  exercise_id: string;
  order_index: number;
  notes?: string;
  exercises: { id: string; name: string; category: string };
  routine_sets: Array<{ id: string; set_index: number; reps: number; weight: number; notes: string }>;
};

type RoutineData = {
  id: string;
  name: string;
  description: string;
  folder_id: string | null;
  routine_exercises: RoutineExerciseData[];
};

export default function RoutinesScreen() {
  const { user } = useAuth();
  const { startWorkout } = useWorkout();
  const { parseWeightInput, displayWeightValue, weightUnit } = useUnits();
  const t = useThemeTokens();

  // Shared small-control styles, so the icon buttons and dialog chrome stay consistent.
  const iconButton = {
    padding: 6,
    borderWidth: 1,
    borderRadius: t.radius.sm,
    borderColor: t.color.border,
    backgroundColor: t.color.surfaceRaised,
  };
  const closeButton = {
    padding: 8,
    borderRadius: t.radius.pill,
    borderWidth: 1,
    borderColor: t.color.border,
    backgroundColor: t.color.surfaceRaised,
  };
  const sheetHeader = {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: t.spacing.lg,
    paddingBottom: t.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: t.color.borderSoft,
  };
  const sheetFooter = {
    paddingHorizontal: t.spacing.lg,
    paddingTop: t.spacing.md,
    paddingBottom: t.spacing.md,
    borderTopWidth: 1,
    borderTopColor: t.color.borderSoft,
  };

  // Data states
  const [routines, setRoutines] = useState<RoutineData[]>([]);
  const [folders, setFolders] = useState<FolderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  // Create Folder states
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  // Routine Builder states
  const [showBuilder, setShowBuilder] = useState(false);
  const [builderRoutineId, setBuilderRoutineId] = useState<string | null>(null);
  const [routineName, setRoutineName] = useState('');
  const [routineDesc, setRoutineDesc] = useState('');
  const [routineFolderId, setRoutineFolderId] = useState<string | null>(null);
  const [builderExercises, setBuilderExercises] = useState<any[]>([]);
  const [savingRoutine, setSavingRoutine] = useState(false);

  // Custom Exercise States
  const [customExercises, setCustomExercises] = useState<any[]>([]);
  const [showCustomExModal, setShowCustomExModal] = useState(false);
  const [customExName, setCustomExName] = useState('');
  const [customExMuscle, setCustomExMuscle] = useState('Chest');
  const [customExType, setCustomExType] = useState('Barbell');
  const [creatingCustomEx, setCreatingCustomEx] = useState(false);

  // Add exercise modal (within builder)
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Fetch Folders & Routines
  const fetchData = async () => {
    if (!user) return;
    try {
      setLoading(true);

      // 1. Fetch folders
      const { data: foldersData, error: foldersError } = await supabase
        .from('folders')
        .select('id, name')
        .eq('user_id', user.id)
        .order('name');
      if (foldersError) throw foldersError;
      setFolders(foldersData || []);

      // 2. Fetch routines
      const { data: routinesData, error: routinesError } = await supabase
        .from('routines')
        .select(`
          id,
          name,
          description,
          folder_id,
          routine_exercises (
            id,
            exercise_id,
            order_index,
            notes,
            exercises (id, name, category),
            routine_sets (id, set_index, reps, weight, notes)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (routinesError) throw routinesError;

      // Sort routine exercises and sets locally
      const formattedRoutines = (routinesData || []).map((r: any) => {
        const sortedExercises = [...(r.routine_exercises || [])].sort(
          (a, b) => a.order_index - b.order_index
        );
        sortedExercises.forEach((ex: any) => {
          ex.routine_sets = [...(ex.routine_sets || [])].sort(
            (a, b) => a.set_index - b.set_index
          );
        });
        return { ...r, routine_exercises: sortedExercises };
      });

      setRoutines(formattedRoutines);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

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
    fetchData();
    fetchCustomExercises();
  }, [user]);

  // Folder Operations
  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !user) return;
    setCreatingFolder(true);
    try {
      const { error } = await supabase
        .from('folders')
        .insert({
          name: newFolderName.trim(),
          user_id: user.id,
        });

      if (error) throw error;
      setNewFolderName('');
      setShowFolderModal(false);
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create folder.');
    } finally {
      setCreatingFolder(false);
    }
  };

  // Routine operations
  const handleDeleteRoutine = (id: string) => {
    Alert.alert(
      'Delete Routine?',
      'This action will permanently delete this routine template.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('routines')
                .delete()
                .eq('id', id);
              if (error) throw error;
              fetchData();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to delete routine.');
            }
          },
        },
      ]
    );
  };

  const handleStartRoutine = (routine: RoutineData) => {
    const initialExercises: ExerciseLog[] = routine.routine_exercises.map((re) => {
      const sets: SetLog[] = re.routine_sets.map((rs) => ({
        weight: '',
        reps: '',
        isCompleted: false,
        notes: rs.notes || '',
        placeholderWeight: String(displayWeightValue(rs.weight)),
        placeholderReps: String(rs.reps),
      }));

      return {
        id: re.exercises.id,
        name: re.exercises.name,
        category: re.exercises.category,
        notes: re.notes || '',
        sets: sets.length > 0 ? sets : [{ weight: '', reps: '', isCompleted: false, notes: '', placeholderWeight: '0', placeholderReps: '10' }],
      };
    });

    startWorkout(routine.name, routine.id, initialExercises);
  };

  // Routine Builder Operations
  const openBuilder = (routine?: RoutineData) => {
    if (routine) {
      setBuilderRoutineId(routine.id);
      setRoutineName(routine.name);
      setRoutineDesc(routine.description || '');
      setRoutineFolderId(routine.folder_id);

      const exercises = routine.routine_exercises.map((re) => ({
        id: re.exercises.id,
        name: re.exercises.name,
        category: re.exercises.category,
        notes: re.notes || '',
        sets: re.routine_sets.map((s) => ({
          weight: String(displayWeightValue(s.weight)),
          reps: String(s.reps),
          notes: s.notes || '',
        })),
      }));
      setBuilderExercises(exercises);
    } else {
      setBuilderRoutineId(null);
      setRoutineName('');
      setRoutineDesc('');
      setRoutineFolderId(activeFolderId);
      setBuilderExercises([]);
    }
    setShowBuilder(true);
  };

  const addExerciseToBuilder = (exercise: any) => {
    const newEx = {
      id: exercise.id,
      name: exercise.name,
      category: exercise.category,
      instructions: exercise.instructions || [],
      notes: '',
      sets: [{ weight: '', reps: '', notes: '' }],
    };
    setBuilderExercises((prev) => [...prev, newEx]);
  };

  const removeExerciseFromBuilder = (idx: number) => {
    setBuilderExercises((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveExerciseUp = (idx: number) => {
    if (idx === 0) return;
    setBuilderExercises((prev) => {
      const copy = [...prev];
      const temp = copy[idx];
      copy[idx] = copy[idx - 1];
      copy[idx - 1] = temp;
      return copy;
    });
  };

  const moveExerciseDown = (idx: number) => {
    if (idx === builderExercises.length - 1) return;
    setBuilderExercises((prev) => {
      const copy = [...prev];
      const temp = copy[idx];
      copy[idx] = copy[idx + 1];
      copy[idx + 1] = temp;
      return copy;
    });
  };

  const updateBuilderExerciseNotes = (idx: number, notes: string) => {
    setBuilderExercises((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], notes };
      return copy;
    });
  };

  const addSetToBuilderExercise = (exIdx: number) => {
    setBuilderExercises((prev) => {
      const copy = [...prev];
      const lastSet = copy[exIdx].sets[copy[exIdx].sets.length - 1];
      copy[exIdx].sets.push({
        weight: lastSet ? lastSet.weight : '',
        reps: lastSet ? lastSet.reps : '10',
        notes: '',
      });
      return copy;
    });
  };

  const removeSetFromBuilderExercise = (exIdx: number, setIdx: number) => {
    setBuilderExercises((prev) => {
      const copy = [...prev];
      copy[exIdx].sets = copy[exIdx].sets.filter((_: any, i: number) => i !== setIdx);
      return copy;
    });
  };

  const updateBuilderSet = (exIdx: number, setIdx: number, fields: any) => {
    setBuilderExercises((prev) => {
      const copy = [...prev];
      copy[exIdx].sets[setIdx] = { ...copy[exIdx].sets[setIdx], ...fields };
      return copy;
    });
  };

  const handleSaveRoutine = async () => {
    if (!routineName.trim() || !user) {
      Alert.alert('Error', 'Please provide a routine name.');
      return;
    }

    if (builderExercises.length === 0) {
      Alert.alert('Error', 'Please add at least one exercise.');
      return;
    }

    setSavingRoutine(true);
    try {
      let routineId = builderRoutineId;

      if (routineId) {
        const { error: updateError } = await supabase
          .from('routines')
          .update({
            name: routineName.trim(),
            description: routineDesc.trim(),
            folder_id: routineFolderId,
          })
          .eq('id', routineId);
        if (updateError) throw updateError;

        const { error: deleteError } = await supabase
          .from('routine_exercises')
          .delete()
          .eq('routine_id', routineId);
        if (deleteError) throw deleteError;
      } else {
        const { data: newRoutine, error: insertError } = await supabase
          .from('routines')
          .insert({
            name: routineName.trim(),
            description: routineDesc.trim(),
            user_id: user.id,
            folder_id: routineFolderId,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        routineId = newRoutine.id;
      }

      for (let i = 0; i < builderExercises.length; i++) {
        const ex = builderExercises[i];

        const { data: exData, error: exError } = await supabase
          .from('routine_exercises')
          .insert({
            routine_id: routineId!,
            exercise_id: ex.id,
            order_index: i,
            notes: ex.notes || '',
          })
          .select()
          .single();

        if (exError) throw exError;
        const routineExerciseId = exData.id;

        const setsToInsert = ex.sets.map((set: any, setIdx: number) => {
          const rawWeight = parseFloat(set.weight) || 0;
          const rawReps = parseInt(set.reps) || 0;
          const weightInKg = parseWeightInput(rawWeight);

          return {
            routine_exercise_id: routineExerciseId,
            set_index: setIdx,
            reps: rawReps,
            weight: weightInKg,
            notes: set.notes,
          };
        });

        const { error: setsError } = await supabase
          .from('routine_sets')
          .insert(setsToInsert);

        if (setsError) throw setsError;
      }

      Alert.alert('Success', 'Routine saved successfully.');
      setShowBuilder(false);
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save routine.');
    } finally {
      setSavingRoutine(false);
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

      const { error } = await supabase
        .from('exercises')
        .insert(newEx);

      if (error) throw error;

      setCustomExercises((prev) => [...prev, newEx]);

      // Automatically add it to routine builder exercises and close creator modal
      const routineEx = {
        ...newEx,
        sets: [{ weight: '', reps: '', notes: '' }],
      };
      setBuilderExercises((prev) => [...prev, routineEx]);
      setShowCustomExModal(false);
      setShowExerciseModal(false);
      Alert.alert('Success', 'Custom exercise created and added to routine.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create custom exercise.');
    } finally {
      setCreatingCustomEx(false);
    }
  };

  const filteredRoutines = routines.filter((r) => {
    if (activeFolderId === null) return true;
    return r.folder_id === activeFolderId;
  });

  // Merge + filter the exercise catalogue once per input change rather than inside an inline IIFE
  // in the picker's ScrollView, which re-ran on every keystroke and every unrelated re-render.
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

  const openExercisePicker = () => {
    setSearchQuery('');
    setSelectedCategory('All');
    setShowExerciseModal(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.color.bg }}>
      <BackgroundGlows />
      <Screen>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginBottom: t.spacing.xl,
          }}
        >
          <View>
            <Text variant="callout" color="textSecondary">
              Library
            </Text>
            <Text variant="title1" style={{ marginTop: 2 }}>
              Routines
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
            <TouchableOpacity
              onPress={() => {
                setNewFolderName('');
                setShowFolderModal(true);
              }}
              style={{
                width: 44,
                height: 44,
                borderRadius: t.radius.md,
                borderWidth: 1,
                borderColor: t.color.border,
                backgroundColor: t.color.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FolderPlus size={18} color={t.color.accent} strokeWidth={2} />
            </TouchableOpacity>
            <Button
              label="New"
              leading={<Plus color={t.color.onAccent} size={16} strokeWidth={2.5} />}
              onPress={() => openBuilder()}
            />
          </View>
        </View>

        {/* Folder filter chips */}
        <View style={{ marginBottom: t.spacing.xl }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: t.spacing.sm }}
          >
            <Chip
              label="All routines"
              selected={activeFolderId === null}
              onPress={() => setActiveFolderId(null)}
            />
            {folders.map((f) => (
              <Chip
                key={f.id}
                label={f.name}
                selected={activeFolderId === f.id}
                onPress={() => setActiveFolderId(f.id)}
              />
            ))}
          </ScrollView>
        </View>

        {/* Routines list */}
        {loading ? (
          <View style={{ paddingVertical: t.spacing.xxxl, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={t.color.accent} />
          </View>
        ) : filteredRoutines.length === 0 ? (
          <Card style={{ alignItems: 'center', gap: t.spacing.sm, paddingVertical: t.spacing.xxl }}>
            <AlertCircle size={24} color={t.color.textTertiary} strokeWidth={1.5} />
            <Text variant="body" color="textSecondary">
              No routines found
            </Text>
            <Text variant="caption" color="textTertiary" style={{ textAlign: 'center', maxWidth: 240 }}>
              Create a routine to save a template for future workouts.
            </Text>
          </Card>
        ) : (
          filteredRoutines.map((routine) => (
            <Card key={routine.id} elevation="raised" style={{ marginBottom: t.spacing.md }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: t.spacing.md,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text variant="heading" numberOfLines={1}>
                    {routine.name}
                  </Text>
                  {routine.description ? (
                    <Text variant="callout" color="textSecondary" style={{ marginTop: t.spacing.xs }}>
                      {routine.description}
                    </Text>
                  ) : null}
                </View>
                <Button
                  label="Start"
                  size="sm"
                  leading={<Dumbbell color={t.color.onAccent} size={15} strokeWidth={2.5} />}
                  onPress={() => handleStartRoutine(routine)}
                />
              </View>

              {routine.routine_exercises?.length ? (
                <View
                  style={{
                    marginTop: t.spacing.md,
                    paddingTop: t.spacing.md,
                    borderTopWidth: 1,
                    borderTopColor: t.color.borderSoft,
                    gap: t.spacing.sm,
                  }}
                >
                  {routine.routine_exercises.map((re, idx) => (
                    <View
                      key={re.id || idx}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}
                    >
                      <Dumbbell size={14} color={t.color.accent} strokeWidth={2} />
                      <Text variant="callout" color="textSecondary" style={{ flex: 1 }} numberOfLines={1}>
                        {re.exercises?.name || 'Exercise'}
                      </Text>
                      <Text variant="callout" color="textTertiary" tabular>
                        {re.routine_sets?.length || 0} sets
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'flex-end',
                  gap: t.spacing.sm,
                  marginTop: t.spacing.md,
                  paddingTop: t.spacing.md,
                  borderTopWidth: 1,
                  borderTopColor: t.color.borderSoft,
                }}
              >
                <TouchableOpacity onPress={() => openBuilder(routine)} hitSlop={6} style={iconButton}>
                  <Edit size={16} color={t.color.accent} strokeWidth={2} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteRoutine(routine.id)} hitSlop={6} style={iconButton}>
                  <Trash2 size={16} color={t.color.danger} strokeWidth={2} />
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}
      </Screen>

      {/* CREATE FOLDER DIALOG */}
      <Modal visible={showFolderModal} transparent animationType="fade" onRequestClose={() => setShowFolderModal(false)}>
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: t.spacing.xl,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
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
              <Text variant="heading">New folder</Text>
              <TouchableOpacity onPress={() => setShowFolderModal(false)} hitSlop={8} style={closeButton}>
                <X size={14} color={t.color.textSecondary} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <Input
              label="Folder name"
              placeholder="e.g. Push / Pull / Legs"
              value={newFolderName}
              onChangeText={setNewFolderName}
              autoCapitalize="words"
              autoFocus
              containerStyle={{ marginBottom: t.spacing.lg }}
            />

            <Button label="Create folder" fullWidth loading={creatingFolder} onPress={handleCreateFolder} />
          </Card>
        </View>
      </Modal>

      {/* FULLSCREEN ROUTINE BUILDER — Sheet carries the delayed-unmount fix (ticket 02). */}
      <Sheet visible={showBuilder} onRequestClose={() => setShowBuilder(false)}>
        <BackgroundGlows />

        {/* Builder header */}
        <View style={sheetHeader}>
          <View style={{ flex: 1, paddingRight: t.spacing.md }}>
            <Text variant="caption" color="textTertiary">
              Routine builder
            </Text>
            <Text variant="heading" style={{ marginTop: 2 }}>
              {builderRoutineId ? 'Edit routine' : 'Create routine'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setShowBuilder(false)} hitSlop={8} style={closeButton}>
            <X size={16} color={t.color.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
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
              label="Routine name"
              placeholder="Enter routine name…"
              value={routineName}
              onChangeText={setRoutineName}
              containerStyle={{ marginBottom: t.spacing.lg }}
            />

            <Input
              label="Description"
              placeholder="Enter routine description…"
              value={routineDesc}
              onChangeText={setRoutineDesc}
              multiline
              containerStyle={{ marginBottom: t.spacing.lg }}
              style={{ height: 72, paddingTop: t.spacing.md, textAlignVertical: 'top' }}
            />

            <Text variant="label" color="textSecondary" style={{ marginBottom: t.spacing.sm }}>
              Assign to folder
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: t.spacing.sm }}
              style={{ marginBottom: t.spacing.xl }}
            >
              <Chip
                label="No folder"
                selected={routineFolderId === null}
                onPress={() => setRoutineFolderId(null)}
              />
              {folders.map((f) => (
                <Chip
                  key={f.id}
                  label={f.name}
                  selected={routineFolderId === f.id}
                  onPress={() => setRoutineFolderId(f.id)}
                />
              ))}
            </ScrollView>

            <Text variant="label" color="textSecondary" style={{ marginBottom: t.spacing.md }}>
              Exercises
            </Text>

            {builderExercises.map((ex, exIdx) => (
              <Card key={ex.id + exIdx} style={{ marginBottom: t.spacing.lg }}>
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
                      <TouchableOpacity onPress={() => moveExerciseUp(exIdx)} hitSlop={6} style={iconButton}>
                        <ChevronUp size={14} color={t.color.accent} strokeWidth={2.5} />
                      </TouchableOpacity>
                    )}
                    {exIdx < builderExercises.length - 1 && (
                      <TouchableOpacity onPress={() => moveExerciseDown(exIdx)} hitSlop={6} style={iconButton}>
                        <ChevronDown size={14} color={t.color.accent} strokeWidth={2.5} />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={() => removeExerciseFromBuilder(exIdx)}
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
                  onChangeText={(text) => updateBuilderExerciseNotes(exIdx, text)}
                  containerStyle={{ marginBottom: t.spacing.md }}
                  style={{ height: 44 }}
                />

                {/* Set column headers */}
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
                  <Text variant="caption" color="textTertiary" style={{ flex: 1, textAlign: 'center' }}>
                    Target {weightUnit}
                  </Text>
                  <Text variant="caption" color="textTertiary" style={{ flex: 1, textAlign: 'center' }}>
                    Target reps
                  </Text>
                  <View style={{ width: 32 }} />
                </View>

                {/* Set rows */}
                {ex.sets.map((set: any, setIdx: number) => (
                  <View
                    key={setIdx}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: t.spacing.sm,
                      paddingVertical: t.spacing.sm,
                      paddingHorizontal: t.spacing.md,
                      marginBottom: t.spacing.sm,
                      borderRadius: t.radius.md,
                      borderWidth: 1,
                      backgroundColor: t.color.surfaceRaised,
                      borderColor: t.color.border,
                    }}
                  >
                    <Text variant="label" color="textTertiary" tabular style={{ width: 26 }}>
                      {String(setIdx + 1).padStart(2, '0')}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <NumericInput
                        placeholder="0"
                        value={set.weight}
                        onChangeText={(text) => updateBuilderSet(exIdx, setIdx, { weight: text })}
                        style={{ height: 44 }}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <NumericInput
                        placeholder="10"
                        value={set.reps}
                        onChangeText={(text) => updateBuilderSet(exIdx, setIdx, { reps: text })}
                        style={{ height: 44 }}
                      />
                    </View>
                    <View style={{ width: 32, alignItems: 'flex-end' }}>
                      {ex.sets.length > 1 && (
                        <TouchableOpacity
                          onPress={() => removeSetFromBuilderExercise(exIdx, setIdx)}
                          hitSlop={8}
                        >
                          <X size={18} color={t.color.danger} strokeWidth={2} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))}

                <Button
                  label="Add set"
                  size="sm"
                  variant="ghost"
                  leading={<Plus size={16} color={t.color.accent} />}
                  onPress={() => addSetToBuilderExercise(exIdx)}
                />
              </Card>
            ))}

            {/* Add exercise trigger */}
            <TouchableOpacity
              onPress={openExercisePicker}
              activeOpacity={0.8}
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
              <Plus color={t.color.accent} size={18} strokeWidth={2.5} />
              <Text variant="bodyStrong" color="accent">
                Add exercise
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Save footer */}
          <View style={sheetFooter}>
            <Button label="Save routine" fullWidth loading={savingRoutine} onPress={handleSaveRoutine} />
          </View>
        </KeyboardAvoidingView>

        {/* EXERCISE SELECTOR — nested INSIDE the builder Sheet: iOS will not present a second
            Modal from a view controller that is already presenting one. */}
        <Sheet visible={showExerciseModal} onRequestClose={() => setShowExerciseModal(false)}>
          <BackgroundGlows />

          <View style={sheetHeader}>
            <Text variant="heading">Add exercise</Text>
            <TouchableOpacity onPress={() => setShowExerciseModal(false)} hitSlop={8} style={closeButton}>
              <X size={16} color={t.color.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={{ paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.md }}>
            <Input
              placeholder="Search exercises…"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
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
            contentContainerStyle={{ paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.xxl }}
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
                    addExerciseToBuilder(ex);
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
                  <TouchableOpacity onPress={() => setShowCustomExModal(false)} hitSlop={8} style={closeButton}>
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
    </View>
  );
}

import React, { useState, useEffect } from 'react';
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
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useUnits } from '../../context/UnitContext';
import { useWorkout, ExerciseLog, SetLog } from '../../context/WorkoutContext';
import { supabase } from '../../lib/supabase';
import exercisesData from '../../data/exercises.json';
import { BackgroundGlows } from '../../components/background-glows';
import { 
  FolderPlus, 
  Plus, 
  Edit, 
  Trash2, 
  Share2, 
  Dumbbell, 
  Folder, 
  X, 
  ChevronRight,
  PlusCircle,
  AlertCircle,
  ChevronUp,
  ChevronDown
} from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

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
  is_shared: boolean;
  likes_count: number;
  routine_exercises: RoutineExerciseData[];
};

export default function RoutinesScreen() {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const { startWorkout } = useWorkout();
  const { parseWeightInput, displayWeightValue, weightUnit } = useUnits();

  // Premium adaptive theme tokens
  const themeCard = isDark ? 'bg-zinc-950/60 border-white/5' : 'bg-white border-zinc-200/80';
  const themeTextHeader = isDark ? 'text-[#e2e2e5]' : 'text-zinc-900';
  const themeTextSub = isDark ? 'text-zinc-400' : 'text-zinc-600';
  const themeTextMuted = isDark ? 'text-zinc-500' : 'text-zinc-400';
  const themeInputText = isDark ? 'text-[#e2e2e5]' : 'text-zinc-900';
  const themeHeaderBg = isDark ? 'bg-zinc-950/60 border-white/5' : 'bg-zinc-100/90 border-zinc-200';
  const themeBorder = isDark ? 'border-white/5' : 'border-zinc-200/80';
  const themeDivider = isDark ? 'border-white/5' : 'border-zinc-200/60';

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

  // Share Routine states
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareRoutine, setShareRoutine] = useState<RoutineData | null>(null);
  const [shareDescription, setShareDescription] = useState('');
  const [sharing, setSharing] = useState(false);

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

  // Interactive focus states for inputs
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const categories = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Biceps', 'Triceps', 'Core', 'Cardio'];
  const systemFont = Platform.OS === 'ios' ? 'System' : 'sans-serif';

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
          is_shared,
          likes_count,
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
        weight: String(displayWeightValue(rs.weight)),
        reps: String(rs.reps),
        isCompleted: false,
        notes: rs.notes || '',
      }));

      return {
        id: re.exercises.id,
        name: re.exercises.name,
        category: re.exercises.category,
        notes: re.notes || '',
        sets: sets.length > 0 ? sets : [{ weight: '', reps: '', isCompleted: false, notes: '' }],
      };
    });

    startWorkout(routine.name, routine.id, initialExercises);
  };

  const handleShareRoutine = async () => {
    if (!shareRoutine) return;
    setSharing(true);
    try {
      const { error } = await supabase
        .from('routines')
        .update({
          is_shared: true,
          description: shareDescription.trim(),
        })
        .eq('id', shareRoutine.id);

      if (error) throw error;
      setShowShareModal(false);
      fetchData();
      Alert.alert('Success', 'Routine template shared with the community feed.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to share routine.');
    } finally {
      setSharing(false);
    }
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
        user_id: user.id
      };
      
      const { error } = await supabase
        .from('exercises')
        .insert(newEx);

      if (error) throw error;

      setCustomExercises((prev) => [...prev, newEx]);
      
      // Automatically add it to routine builder exercises and close creator modal
      const routineEx = {
        ...newEx,
        sets: [{ weight: '', reps: '', notes: '' }]
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

  const filteredExercises = exercisesData.filter((ex) => {
    const matchesSearch = ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ex.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || ex.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.dark }}>
      <BackgroundGlows />
      
      <ScrollView
        style={{ flex: 1, backgroundColor: 'transparent' }} 
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 140 }}
      >
        {/* Header */}
        <View className={`flex-row justify-between items-center mb-6 pb-4 border-b ${themeDivider}`}>
          <View>
            <Text 
              className="text-zinc-500 text-[10px] uppercase tracking-wider font-bold"
              style={{ fontFamily: systemFont }}
            >
              Library
            </Text>
            <Text 
              className={`text-lg font-bold mt-1 ${themeTextHeader}`}
              style={{ fontFamily: systemFont }}
            >
              Routines
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={() => {
                setNewFolderName('');
                setShowFolderModal(true);
              }}
              className={`border px-3 py-2 ${isDark ? 'bg-zinc-900/80 border-white/5' : 'bg-white border-zinc-200'}`}
              style={{ borderRadius: 12 }}
            >
              <FolderPlus size={15} color="#ea580c" strokeWidth={2} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => openBuilder()}
              className="bg-[#ea580c] px-4 py-2 flex-row items-center gap-1.5"
              style={{ borderRadius: 12 }}
            >
              <Plus color="#ffffff" size={14} strokeWidth={2.5} />
              <Text 
                className="text-white font-bold text-xs uppercase tracking-wider"
                style={{ fontFamily: systemFont }}
              >
                New Routine
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Folders Horizontal Scroll */}
        <View className="mb-6">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              onPress={() => setActiveFolderId(null)}
              className="px-4 py-2 mr-2 border"
              style={{
                borderRadius: 100,
                backgroundColor: activeFolderId === null ? '#ea580c' : (isDark ? 'rgba(255, 255, 255, 0.02)' : '#ffffff'),
                borderColor: activeFolderId === null ? '#ea580c' : (isDark ? 'rgba(255, 255, 255, 0.08)' : '#e4e4e7'),
              }}
            >
              <Text
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{
                  fontFamily: systemFont,
                  color: activeFolderId === null ? '#ffffff' : (isDark ? '#e2e2e5' : '#18181b'),
                }}
              >
                All Routines
              </Text>
            </TouchableOpacity>
            {folders.map((f) => (
              <TouchableOpacity
                key={f.id}
                onPress={() => setActiveFolderId(f.id)}
                className="px-4 py-2 mr-2 border flex-row items-center gap-1.5"
                style={{
                  borderRadius: 100,
                  backgroundColor: activeFolderId === f.id ? '#ea580c' : (isDark ? 'rgba(255, 255, 255, 0.02)' : '#ffffff'),
                  borderColor: activeFolderId === f.id ? '#ea580c' : (isDark ? 'rgba(255, 255, 255, 0.08)' : '#e4e4e7'),
                }}
              >
                <Folder size={10} color={activeFolderId === f.id ? '#ffffff' : '#ea580c'} />
                <Text
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{
                    fontFamily: systemFont,
                    color: activeFolderId === f.id ? '#ffffff' : (isDark ? '#e2e2e5' : '#18181b'),
                  }}
                >
                  {f.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Routines List */}
        <View>
          {loading ? (
            <View className="py-12 justify-center items-center">
              <ActivityIndicator size="small" color="#ea580c" />
            </View>
          ) : filteredRoutines.length === 0 ? (
            <View 
              className={`border p-8 items-center justify-center ${themeCard}`}
              style={{ borderRadius: 24 }}
            >
              <AlertCircle size={24} color="#5c5c61" strokeWidth={1.5} className="mb-2.5" />
              <Text 
                className={`font-bold text-[11px] mb-1.5 ${themeTextSub}`}
                style={{ fontFamily: systemFont }}
              >
                No routines found
              </Text>
              <Text 
                className="text-zinc-500 text-[9px] text-center max-w-[210px] leading-relaxed font-semibold"
                style={{ fontFamily: systemFont }}
              >
                Create a routine to save a template for future workouts.
              </Text>
            </View>
          ) : (
            filteredRoutines.map((routine) => (
              <View
                key={routine.id}
                className={`border p-5 mb-4 ${themeCard}`}
                style={{
                  borderRadius: 24,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: isDark ? 0.35 : 0.05,
                  shadowRadius: 16,
                  elevation: 5,
                }}
              >
                <View className="flex-row justify-between items-start mb-3">
                  <View className="flex-1 pr-2">
                    <Text 
                      className={`font-bold text-sm uppercase tracking-wide ${themeTextHeader}`}
                      style={{ fontFamily: systemFont }}
                    >
                      {routine.name}
                    </Text>
                    {routine.description ? (
                      <Text 
                        className={`text-[10px] mt-1.5 leading-relaxed ${themeTextSub}`}
                        style={{ fontFamily: systemFont }}
                      >
                        {routine.description}
                      </Text>
                    ) : null}
                  </View>
                  <View className="flex-row items-center gap-2">
                    <TouchableOpacity
                      onPress={() => handleStartRoutine(routine)}
                      className="bg-[#ea580c] px-3.5 py-2 flex-row items-center gap-1.5"
                      style={{ borderRadius: 12 }}
                    >
                      <Dumbbell color="#ffffff" size={13} strokeWidth={2.5} />
                      <Text 
                        className="text-white font-bold text-[10px] uppercase tracking-wider"
                        style={{ fontFamily: systemFont }}
                      >
                        Start
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Exercises Preview inside Routine Card */}
                <View className={`border-t pt-3.5 mt-4 ${themeDivider}`}>
                  {routine.routine_exercises?.map((re, idx) => (
                    <View key={re.id || idx} className="flex-row items-center mt-1.5">
                      <Dumbbell size={10} color="#ea580c" className="mr-2" />
                      <Text 
                        className={`text-[10px] font-bold uppercase tracking-wider ${themeTextSub}`}
                        style={{ fontFamily: systemFont }}
                      >
                        {re.exercises?.name || 'Exercise'} <Text className="text-[#ea580c]">({re.routine_sets?.length || 0} sets)</Text>
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Card Actions (Edit, Delete, Share) */}
                <View className="flex-row justify-end items-center gap-2 mt-4 pt-3 border-t border-white/5">
                  <TouchableOpacity
                    onPress={() => {
                      setShareRoutine(routine);
                      setShareDescription(routine.description || '');
                      setShowShareModal(true);
                    }}
                    className={`p-2 border ${isDark ? 'bg-zinc-900/80 border-white/5' : 'bg-zinc-100 border-zinc-200'}`}
                    style={{ borderRadius: 10 }}
                  >
                    <Share2 size={13} color="#8b5cf6" strokeWidth={2} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => openBuilder(routine)}
                    className={`p-2 border ${isDark ? 'bg-zinc-900/80 border-white/5' : 'bg-zinc-100 border-zinc-200'}`}
                    style={{ borderRadius: 10 }}
                  >
                    <Edit size={13} color="#ea580c" strokeWidth={2} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteRoutine(routine.id)}
                    className={`p-2 border ${isDark ? 'bg-zinc-900/80 border-white/5' : 'bg-zinc-100 border-zinc-200'}`}
                    style={{ borderRadius: 10 }}
                  >
                    <Trash2 size={13} color="#ff453a" strokeWidth={2} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* CREATE FOLDER DIALOG */}
      <Modal visible={showFolderModal} transparent animationType="fade">
        <View 
          className="flex-1 justify-center items-center px-6"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.82)' }}
        >
          <View 
            className={`border p-6 w-full ${isDark ? 'bg-zinc-950/90 border-white/10' : 'bg-white border-zinc-200'}`}
            style={{ borderRadius: 24, elevation: 8 }}
          >
            <View className="flex-row justify-between items-center mb-5">
              <Text 
                className={`text-sm font-bold uppercase tracking-wider ${themeTextHeader}`}
                style={{ fontFamily: systemFont }}
              >
                New Folder
              </Text>
              <TouchableOpacity 
                onPress={() => setShowFolderModal(false)} 
                className={`p-1 border ${isDark ? 'border-white/5 bg-zinc-900' : 'border-zinc-200 bg-zinc-100'}`}
                style={{ borderRadius: 100 }}
              >
                <X size={12} color="#71717a" strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <TextInput
              className={`border px-4 py-3 text-sm h-12 mb-5 ${isDark ? 'bg-zinc-900/50 text-[#e2e2e5]' : 'bg-zinc-50 text-zinc-900'}`}
              style={{
                borderRadius: 14,
                borderColor: focusedField === 'folder' ? '#ea580c' : (isDark ? 'rgba(255, 255, 255, 0.08)' : '#cbd5e1'),
              }}
              placeholder="Enter folder name..."
              placeholderTextColor={isDark ? '#5c5c61' : '#a1a1aa'}
              value={newFolderName}
              onChangeText={setNewFolderName}
              autoCapitalize="words"
              autoFocus
              onFocus={() => setFocusedField('folder')}
              onBlur={() => setFocusedField(null)}
            />

            <TouchableOpacity
              onPress={handleCreateFolder}
              disabled={creatingFolder}
              className="w-full py-3.5 bg-[#ea580c] items-center justify-center"
              style={{ borderRadius: 14 }}
            >
              {creatingFolder ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text 
                  className="text-white font-bold text-xs uppercase tracking-wider"
                  style={{ fontFamily: systemFont }}
                >
                  Create Folder
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* SHARE ROUTINE DIALOG */}
      <Modal visible={showShareModal} transparent animationType="fade">
        <View 
          className="flex-1 justify-center items-center px-6"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.82)' }}
        >
          <View 
            className={`border p-6 w-full ${isDark ? 'bg-zinc-950/90 border-white/10' : 'bg-white border-zinc-200'}`}
            style={{ borderRadius: 24, elevation: 8 }}
          >
            <View className="flex-row justify-between items-center mb-4">
              <Text 
                className={`text-sm font-bold uppercase tracking-wider ${themeTextHeader}`}
                style={{ fontFamily: systemFont }}
              >
                Share Routine Template
              </Text>
              <TouchableOpacity 
                onPress={() => setShowShareModal(false)} 
                className={`p-1 border ${isDark ? 'border-white/5 bg-zinc-900' : 'border-zinc-200 bg-zinc-100'}`}
                style={{ borderRadius: 100 }}
              >
                <X size={12} color="#71717a" strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <Text 
              className="text-[10px] text-zinc-500 mb-4 leading-relaxed font-bold uppercase tracking-wider"
              style={{ fontFamily: systemFont }}
            >
              Sharing this routine publishes it to the community discovery feed.
            </Text>

            <TextInput
              className={`border px-4 py-3 text-xs mb-5 h-20 leading-relaxed ${
                isDark ? 'bg-zinc-900/50 text-[#e2e2e5]' : 'bg-zinc-50 text-zinc-900'
              }`}
              style={{
                borderRadius: 14,
                borderColor: focusedField === 'share' ? '#ea580c' : (isDark ? 'rgba(255, 255, 255, 0.08)' : '#cbd5e1'),
              }}
              placeholder="Add instructions or description for the community..."
              placeholderTextColor={isDark ? '#5c5c61' : '#a1a1aa'}
              value={shareDescription}
              onChangeText={setShareDescription}
              multiline
              onFocus={() => setFocusedField('share')}
              onBlur={() => setFocusedField(null)}
            />

            <TouchableOpacity
              onPress={handleShareRoutine}
              disabled={sharing}
              className="w-full py-3.5 bg-[#ea580c] items-center justify-center"
              style={{ borderRadius: 14 }}
            >
              {sharing ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text 
                  className="text-white font-bold text-xs uppercase tracking-wider"
                  style={{ fontFamily: systemFont }}
                >
                  Share with Community
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* FULL SCREEN ROUTINE BUILDER MODAL */}
      <Modal visible={showBuilder} animationType="slide" presentationStyle="fullScreen">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.dark }}>
          <BackgroundGlows />

          {/* Builder Header */}
          <View className={`flex-row justify-between items-center px-4 py-4 border-b ${themeBorder} ${themeHeaderBg}`}>
            <View>
              <Text 
                className="text-zinc-500 text-[9px] uppercase tracking-widest font-bold"
                style={{ fontFamily: systemFont }}
              >
                Routine Builder
              </Text>
              <Text 
                className={`text-sm font-bold mt-1 uppercase tracking-wide ${themeTextHeader}`}
                style={{ fontFamily: systemFont }}
              >
                {builderRoutineId ? 'Edit Routine' : 'Create Routine'}
              </Text>
            </View>
            <TouchableOpacity 
              onPress={() => setShowBuilder(false)} 
              style={{ 
                padding: 6,
                borderWidth: 1,
                borderRadius: 100,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#e4e4e7',
                backgroundColor: isDark ? 'rgba(24, 24, 27, 0.8)' : '#f4f4f5'
              }}
            >
              <X size={14} color="#71717a" strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, backgroundColor: 'transparent' }}
          >
            <ScrollView 
              style={{ flex: 1, backgroundColor: 'transparent' }}
              contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 60 }}
            >
              <Text 
                className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-2"
                style={{ fontFamily: systemFont }}
              >
                Routine Name
              </Text>
              <View 
                style={{
                  borderWidth: 1,
                  padding: 2,
                  marginBottom: 16,
                  backgroundColor: isDark ? 'rgba(24, 24, 27, 0.4)' : '#f4f4f5',
                  borderRadius: 14,
                  borderColor: focusedField === 'name' ? '#ea580c' : (isDark ? 'rgba(255, 255, 255, 0.08)' : '#cbd5e1'),
                }}
              >
                <TextInput
                  className={`px-4 py-3.5 text-sm h-12 ${themeInputText}`}
                  placeholder="Enter routine name..."
                  placeholderTextColor={isDark ? '#5c5c61' : '#a1a1aa'}
                  value={routineName}
                  onChangeText={setRoutineName}
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>

              <Text 
                className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-2"
                style={{ fontFamily: systemFont }}
              >
                Description
              </Text>
              <View 
                style={{
                  borderWidth: 1,
                  padding: 2,
                  marginBottom: 16,
                  backgroundColor: isDark ? 'rgba(24, 24, 27, 0.4)' : '#f4f4f5',
                  borderRadius: 14,
                  borderColor: focusedField === 'desc' ? '#ea580c' : (isDark ? 'rgba(255, 255, 255, 0.08)' : '#cbd5e1'),
                }}
              >
                <TextInput
                  className={`px-4 py-3 text-xs h-16 leading-relaxed ${themeInputText}`}
                  placeholder="Enter routine description..."
                  placeholderTextColor={isDark ? '#5c5c61' : '#a1a1aa'}
                  value={routineDesc}
                  onChangeText={setRoutineDesc}
                  multiline
                  onFocus={() => setFocusedField('desc')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>

              {/* Folder/Split Selector */}
              <Text 
                className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-2"
                style={{ fontFamily: systemFont }}
              >
                Assign to Split Folder
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
                <TouchableOpacity
                  onPress={() => setRoutineFolderId(null)}
                  style={{ 
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    marginRight: 8,
                    borderWidth: 1,
                    borderRadius: 100,
                    backgroundColor: routineFolderId === null ? '#ea580c' : (isDark ? 'rgba(255, 255, 255, 0.02)' : '#ffffff'),
                    borderColor: routineFolderId === null ? '#ea580c' : (isDark ? 'rgba(255, 255, 255, 0.08)' : '#cbd5e1')
                  }}
                >
                  <Text 
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ 
                      fontFamily: systemFont,
                      color: routineFolderId === null ? '#ffffff' : (isDark ? '#8e8e93' : '#71717a') 
                    }}
                  >
                    No Folder
                  </Text>
                </TouchableOpacity>
                {folders.map((f) => (
                  <TouchableOpacity
                    key={f.id}
                    onPress={() => setRoutineFolderId(f.id)}
                    style={{ 
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      marginRight: 8,
                      borderWidth: 1,
                      borderRadius: 100,
                      backgroundColor: routineFolderId === f.id ? '#ea580c' : (isDark ? 'rgba(255, 255, 255, 0.02)' : '#ffffff'),
                      borderColor: routineFolderId === f.id ? '#ea580c' : (isDark ? 'rgba(255, 255, 255, 0.08)' : '#cbd5e1')
                    }}
                  >
                    <Text 
                      className="text-[10px] font-bold uppercase tracking-wider"
                      style={{ 
                        fontFamily: systemFont,
                        color: routineFolderId === f.id ? '#ffffff' : (isDark ? '#8e8e93' : '#71717a') 
                      }}
                    >
                      {f.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Exercises list in builder */}
              <Text 
                className="text-[10px] font-bold text-zinc-500 mb-4 ml-1 uppercase tracking-wider"
                style={{ fontFamily: systemFont }}
              >
                Exercises
              </Text>

              {builderExercises.map((ex, exIdx) => (
                <View
                  key={ex.id + exIdx}
                  style={{
                    borderWidth: 1,
                    padding: 16,
                    marginBottom: 20,
                    backgroundColor: isDark ? 'rgba(9, 9, 11, 0.6)' : '#ffffff',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(228, 228, 230, 0.8)',
                    borderRadius: 24,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: isDark ? 0.3 : 0.05,
                    shadowRadius: 12,
                    elevation: 4,
                  }}
                >
                  {/* Exercise Header */}
                  <View className={`flex-row justify-between items-center mb-3 pb-2 border-b ${themeDivider}`}>
                    <View className="flex-1 pr-2">
                      <Text 
                        className={`font-bold text-sm uppercase tracking-wide ${themeTextHeader}`} 
                        style={{ fontFamily: systemFont }}
                      >
                        {ex.name}
                      </Text>
                      <Text 
                        className="text-[#ea580c] text-[9px] uppercase font-bold tracking-widest mt-0.5"
                        style={{ fontFamily: systemFont }}
                      >
                        {ex.category}{getExerciseTypeLabel(ex) ? ` • ${getExerciseTypeLabel(ex)}` : ''}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-1.5 mr-2">
                      {exIdx > 0 && (
                        <TouchableOpacity
                          onPress={() => moveExerciseUp(exIdx)}
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
                      {exIdx < builderExercises.length - 1 && (
                        <TouchableOpacity
                          onPress={() => moveExerciseDown(exIdx)}
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
                    <TouchableOpacity 
                      onPress={() => removeExerciseFromBuilder(exIdx)} 
                      className={`px-3 py-1.5 border ${isDark ? 'bg-red-950/10 border-red-500/20' : 'bg-red-50 border-red-200'}`}
                      style={{ borderRadius: 100 }}
                    >
                      <Text 
                        className="text-[#ff453a] font-bold text-[9px] uppercase tracking-wider"
                        style={{ fontFamily: systemFont }}
                      >
                        Remove
                      </Text>
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
                      onChangeText={(text) => updateBuilderExerciseNotes(exIdx, text)}
                      style={{ fontFamily: systemFont }}
                    />
                  </View>

                  {/* Target Sets table header */}
                  <View className="flex-row items-center mb-2 px-1">
                    <Text className="w-8 text-[9px] font-bold text-zinc-500 uppercase">Set</Text>
                    <Text className="flex-1 text-[9px] font-bold text-zinc-500 text-center uppercase">Target Wt ({weightUnit})</Text>
                    <Text className="flex-1 text-[9px] font-bold text-zinc-500 text-center uppercase">Target Reps</Text>
                    <Text className="w-10"></Text>
                  </View>

                  {/* Target Sets rows */}
                  {ex.sets.map((set: any, setIdx: number) => (
                    <View 
                      key={setIdx} 
                      style={{ 
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        borderWidth: 1,
                        marginBottom: 8,
                        backgroundColor: isDark ? 'rgba(9, 9, 11, 0.6)' : '#ffffff',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(228, 228, 230, 0.8)',
                        borderRadius: 14 
                      }}
                    >
                      <Text className="w-8 text-xs font-bold text-zinc-500" style={{ fontFamily: systemFont }}>
                        {String(setIdx + 1).padStart(2, '0')}
                      </Text>
                      
                      <View className="flex-1 px-1.5">
                        <TextInput
                          keyboardType="numeric"
                          className={`font-bold ${isDark ? 'text-[#e2e2e5]' : 'text-zinc-900'}`}
                          style={{ 
                            borderRadius: 10,
                            height: 36,
                            borderWidth: 1,
                            textAlign: 'center',
                            fontSize: 12,
                            paddingVertical: 6,
                            backgroundColor: isDark ? 'rgba(9, 9, 11, 0.4)' : '#ffffff',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#e4e4e7'
                          }}
                          value={set.weight}
                          onChangeText={(text) => updateBuilderSet(exIdx, setIdx, { weight: text })}
                          placeholder="0"
                          placeholderTextColor={isDark ? '#5c5c61' : '#a1a1aa'}
                          selectTextOnFocus
                        />
                      </View>

                      <View className="flex-1 px-1.5">
                        <TextInput
                          keyboardType="number-pad"
                          className={`font-bold ${isDark ? 'text-[#e2e2e5]' : 'text-zinc-900'}`}
                          style={{ 
                            borderRadius: 10,
                            height: 36,
                            borderWidth: 1,
                            textAlign: 'center',
                            fontSize: 12,
                            paddingVertical: 6,
                            backgroundColor: isDark ? 'rgba(9, 9, 11, 0.4)' : '#ffffff',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#e4e4e7'
                          }}
                          value={set.reps}
                          onChangeText={(text) => updateBuilderSet(exIdx, setIdx, { reps: text })}
                          placeholder="10"
                          placeholderTextColor={isDark ? '#5c5c61' : '#a1a1aa'}
                          selectTextOnFocus
                        />
                      </View>

                      {/* Delete set */}
                      <View className="w-10 items-end">
                        {ex.sets.length > 1 && (
                          <TouchableOpacity onPress={() => removeSetFromBuilderExercise(exIdx, setIdx)} className="p-1">
                            <X size={14} color="#ff453a" strokeWidth={2} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))}

                  {/* Add set button inside exercise */}
                  <TouchableOpacity
                    onPress={() => addSetToBuilderExercise(exIdx)}
                    style={{ 
                      borderWidth: 1,
                      borderColor: 'rgba(234, 88, 12, 0.3)',
                      backgroundColor: 'rgba(234, 88, 12, 0.05)',
                      paddingVertical: 6,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: 8,
                      flexDirection: 'row',
                      borderRadius: 100 
                    }}
                  >
                    <Text className="text-[#ea580c] text-[10px] font-bold uppercase tracking-wider">
                      + Add Set Preset
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}

              {/* Add exercise trigger button */}
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setSelectedCategory('All');
                  setShowExerciseModal(true);
                }}
                activeOpacity={0.8}
                style={{ 
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  paddingVertical: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  marginBottom: 64,
                  backgroundColor: isDark ? 'rgba(9, 9, 11, 0.6)' : '#ffffff',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(228, 228, 230, 0.8)',
                  borderRadius: 20 
                }}
              >
                <Plus color="#ea580c" size={14} className="mr-2" strokeWidth={2.5} />
                <Text 
                  className="text-[#ea580c] font-bold text-xs uppercase tracking-wider"
                  style={{ fontFamily: systemFont }}
                >
                  Add Exercise
                </Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Save Button Footer */}
            <View className={`px-4 py-4 border-t ${themeBorder} ${themeHeaderBg}`}>
              <TouchableOpacity
                onPress={handleSaveRoutine}
                disabled={savingRoutine}
                style={{ 
                  width: '100%', 
                  backgroundColor: '#ea580c', 
                  paddingVertical: 14, 
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {savingRoutine ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text 
                    className="text-white font-bold text-xs uppercase tracking-wider"
                    style={{ fontFamily: systemFont }}
                  >
                    Save Routine
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* CUSTOM EXERCISE SELECTOR OVERLAY (BUILDER) */}
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

                  {/* Selector Header */}
                  <View className={`flex-row justify-between items-center px-4 py-4 border-b ${themeBorder} ${themeHeaderBg}`}>
                    <Text 
                      className={`text-sm font-bold tracking-wide ${themeTextHeader}`}
                      style={{ fontFamily: systemFont }}
                    >
                      Add Exercise
                    </Text>
                    <TouchableOpacity 
                      onPress={() => setShowExerciseModal(false)} 
                      style={{ 
                        padding: 6,
                        borderWidth: 1,
                        borderRadius: 100,
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#e4e4e7',
                        backgroundColor: isDark ? 'rgba(24, 24, 27, 0.8)' : '#f4f4f5'
                      }}
                    >
                      <X size={14} color="#71717a" strokeWidth={2} />
                    </TouchableOpacity>
                  </View>

                  {/* Search bar */}
                  <View className={`px-4 py-3 flex-row items-center border-b ${themeBorder} ${isDark ? 'bg-zinc-950/40' : 'bg-zinc-50'}`}>
                    <TextInput
                      className={`flex-1 text-sm h-8 ${themeInputText}`}
                      style={{ fontFamily: systemFont }}
                      placeholder="Search exercises..."
                      placeholderTextColor={isDark ? '#5c5c61' : '#a1a1aa'}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>

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

                  {/* Categories Selector */}
                  <View className={`py-3 border-b ${themeBorder} ${isDark ? 'bg-zinc-950/20' : 'bg-zinc-100/30'}`}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4">
                      {categories.map((cat) => (
                        <TouchableOpacity
                          key={cat}
                          onPress={() => setSelectedCategory(cat)}
                          style={{ 
                            paddingHorizontal: 16,
                            paddingVertical: 8,
                            marginRight: 8,
                            borderWidth: 1,
                            borderRadius: 100, 
                            backgroundColor: selectedCategory === cat ? '#ea580c' : (isDark ? 'rgba(255, 255, 255, 0.02)' : '#ffffff'),
                            borderColor: selectedCategory === cat ? '#ea580c' : (isDark ? 'rgba(255, 255, 255, 0.08)' : '#e4e4e7')
                          }}
                        >
                          <Text 
                            className="text-[10px] font-bold uppercase tracking-wider"
                            style={{ 
                              fontFamily: systemFont,
                              color: selectedCategory === cat ? '#ffffff' : '#8e8e93' 
                            }}
                          >
                            {cat}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  {/* Exercises List */}
                  <ScrollView className="flex-1 px-4 pt-3">
                    {(() => {
                      // Merge static JSON exercises with fetched custom exercises
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
                        <TouchableOpacity
                          key={ex.id}
                          onPress={() => {
                            addExerciseToBuilder(ex);
                            setShowExerciseModal(false);
                          }}
                          activeOpacity={0.8}
                          style={{ 
                            borderWidth: 1,
                            padding: 16,
                            marginBottom: 12,
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            backgroundColor: isDark ? 'rgba(9, 9, 11, 0.6)' : '#ffffff',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(228, 228, 230, 0.8)',
                            borderRadius: 18 
                          }}
                        >
                          <View className="flex-1 pr-2">
                            <Text 
                              className={`font-semibold text-sm tracking-wide ${themeTextHeader}`}
                              style={{ fontFamily: systemFont }}
                            >
                              {ex.name}
                            </Text>
                            <Text 
                              className="text-[#ea580c] text-[10px] font-semibold mt-1 tracking-wide"
                              style={{ fontFamily: systemFont }}
                            >
                              {ex.category}{getExerciseTypeLabel(ex) ? ` • ${getExerciseTypeLabel(ex)}` : ''}
                            </Text>
                          </View>
                          <View 
                            style={{ 
                              width: 28,
                              height: 28,
                              borderWidth: 1,
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: 100,
                              backgroundColor: isDark ? 'rgba(24, 24, 27, 0.8)' : '#f4f4f5',
                              borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#e4e4e7'
                            }}
                          >
                            <Plus color="#ea580c" size={14} strokeWidth={2.5} />
                          </View>
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
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

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
  RefreshControl,
  Platform,
  Pressable,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useUnits } from '../../context/UnitContext';
import { supabase } from '../../lib/supabase';
import { BackgroundGlows } from '../../components/background-glows';
import { 
  Heart, 
  Download, 
  Eye, 
  Search, 
  X, 
  Dumbbell, 
  User, 
  Calendar,
  Sparkles,
  AlertCircle
} from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

type SharedRoutine = {
  id: string;
  name: string;
  description: string;
  likes_count: number;
  user_id: string;
  profiles: { username: string };
  routine_exercises: Array<{
    id: string;
    exercise_id: string;
    order_index: number;
    exercises: { name: string; category: string };
    routine_sets: Array<{ set_index: number; reps: number; weight: number; notes: string }>;
  }>;
};

export default function SocialScreen() {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const { displayWeightValue, weightUnit } = useUnits();

  // Feed states
  const [feed, setFeed] = useState<SharedRoutine[]>([]);
  const [userLikedRoutineIds, setUserLikedRoutineIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Search / Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSplit, setSelectedSplit] = useState('All');

  // Detail Modal states
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRoutine, setSelectedRoutine] = useState<SharedRoutine | null>(null);
  const [importingRoutineId, setImportingRoutineId] = useState<string | null>(null);

  const splits = ['All', 'Full Body', 'Push Pull Legs', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'];
  const systemFont = Platform.OS === 'ios' ? 'System' : 'sans-serif';

  // Fetch Public Feed
  const fetchFeed = async () => {
    try {
      setLoading(true);

      const { data: routinesData, error: routinesError } = await supabase
        .from('routines')
        .select(`
          id,
          name,
          description,
          likes_count,
          user_id,
          profiles (username),
          routine_exercises (
            id,
            exercise_id,
            order_index,
            exercises (name, category),
            routine_sets (id, set_index, reps, weight, notes)
          )
        `)
        .eq('is_shared', true)
        .order('likes_count', { ascending: false });

      if (routinesError) throw routinesError;

      const formattedFeed = (routinesData || []).map((r: any) => {
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

      setFeed(formattedFeed);

      if (user) {
        const { data: likesData, error: likesError } = await supabase
          .from('likes')
          .select('routine_id')
          .eq('user_id', user.id);

        if (likesError) throw likesError;
        setUserLikedRoutineIds((likesData || []).map((l) => l.routine_id));
      }
    } catch (e) {
      console.error('Error fetching social feed:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFeed();
  }, [user]);

  // Upvote / Like Routine Toggle
  const handleLikeToggle = async (routineId: string) => {
    if (!user) return;

    const isLiked = userLikedRoutineIds.includes(routineId);
    
    setFeed((prevFeed) =>
      prevFeed.map((r) => {
        if (r.id === routineId) {
          return {
            ...r,
            likes_count: isLiked ? Math.max(0, r.likes_count - 1) : r.likes_count + 1,
          };
        }
        return r;
      })
    );

    if (isLiked) {
      setUserLikedRoutineIds((prev) => prev.filter((id) => id !== routineId));
    } else {
      setUserLikedRoutineIds((prev) => [...prev, routineId]);
    }

    try {
      if (isLiked) {
        const { error } = await supabase
          .from('likes')
          .delete()
          .match({ user_id: user.id, routine_id: routineId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('likes')
          .insert({ user_id: user.id, routine_id: routineId });
        if (error) throw error;
      }
      
      const { data: checkData } = await supabase
        .from('routines')
        .select('likes_count')
        .eq('id', routineId)
        .single();
      
      if (checkData) {
        setFeed((prevFeed) =>
          prevFeed.map((r) => (r.id === routineId ? { ...r, likes_count: checkData.likes_count } : r))
        );
      }
    } catch (e) {
      console.error('Error toggling like:', e);
      fetchFeed();
    }
  };

  // One-Tap Import Engine
  const handleImportRoutine = async (routine: SharedRoutine) => {
    if (!user) return;
    
    setImportingRoutineId(routine.id);
    try {
      const { data: newRoutine, error: routineError } = await supabase
        .from('routines')
        .insert({
          user_id: user.id,
          name: `${routine.name} (Imported)`,
          description: routine.description || `Imported from ${routine.profiles?.username || 'community'}.`,
          is_shared: false,
          folder_id: null,
        })
        .select()
        .single();

      if (routineError) throw routineError;
      const newRoutineId = newRoutine.id;

      for (let i = 0; i < routine.routine_exercises.length; i++) {
        const sharedEx = routine.routine_exercises[i];

        const { data: newEx, error: exError } = await supabase
          .from('routine_exercises')
          .insert({
            routine_id: newRoutineId,
            exercise_id: sharedEx.exercise_id,
            order_index: sharedEx.order_index,
          })
          .select()
          .single();

        if (exError) throw exError;
        const newExerciseId = newEx.id;

        const setsToInsert = sharedEx.routine_sets.map((set) => ({
          routine_exercise_id: newExerciseId,
          set_index: set.set_index,
          reps: set.reps,
          weight: set.weight,
          notes: set.notes,
        }));

        const { error: setsError } = await supabase
          .from('routine_sets')
          .insert(setsToInsert);

        if (setsError) throw setsError;
      }

      Alert.alert(
        'Routine Imported!',
        `"${routine.name}" has been successfully added to your personal library. You can find it in the Splits tab.`,
        [{ text: 'OK' }]
      );
      setShowDetailModal(false);
    } catch (e: any) {
      Alert.alert('Import Failed', e.message || 'Failed to import routine.');
    } finally {
      setImportingRoutineId(null);
    }
  };

  const filteredFeed = feed.filter((routine) => {
    const matchesSearch =
      routine.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (routine.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      routine.routine_exercises.some((re) => re.exercises?.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesSplit =
      selectedSplit === 'All' ||
      routine.name.toLowerCase().includes(selectedSplit.toLowerCase()) ||
      (routine.description || '').toLowerCase().includes(selectedSplit.toLowerCase()) ||
      routine.routine_exercises.some((re) => re.exercises?.category === selectedSplit);

    return matchesSearch && matchesSplit;
  });

  // Premium adaptive theme tokens
  const themeCard = isDark ? 'bg-zinc-950/60 border-white/5' : 'bg-white border-zinc-200/80';
  const themeTextHeader = isDark ? 'text-[#e2e2e5]' : 'text-zinc-900';
  const themeTextSub = isDark ? 'text-zinc-400' : 'text-zinc-600';
  const themeTextMuted = isDark ? 'text-zinc-500' : 'text-zinc-400';
  const themeInputText = isDark ? 'text-[#e2e2e5]' : 'text-zinc-900';
  const themeHeaderBg = isDark ? 'bg-zinc-950/60 border-white/5' : 'bg-zinc-100/90 border-zinc-200';
  const themeBorder = isDark ? 'border-white/5' : 'border-zinc-200/80';
  const themeDivider = isDark ? 'border-white/5' : 'border-zinc-200/60';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.dark }}>
      <BackgroundGlows />
      
      {/* Header */}
      <View className={`px-4 pt-4 mb-4 border-b pb-4 ${themeDivider}`}>
        <Text 
          className="text-zinc-500 text-[10px] tracking-wide font-semibold"
          style={{ fontFamily: systemFont }}
        >
          Community Shared Workouts
        </Text>
        <Text 
          className={`text-lg font-bold mt-1 ${themeTextHeader}`}
          style={{ fontFamily: systemFont }}
        >
          Discover Routines
        </Text>
      </View>

      {/* Search Input */}
      <View className="px-4 mb-4 flex-row items-center">
        <View 
          className={`flex-grow flex-row items-center border px-4 py-2.5 ${themeCard}`}
          style={{ borderRadius: 16 }}
        >
          <Search size={14} color="#5c5c61" className="mr-2" />
          <TextInput
            className={`flex-grow text-sm h-6 ${themeInputText}`}
            style={{ fontFamily: systemFont }}
            placeholder="Search routines, exercises, or authors..."
            placeholderTextColor={isDark ? '#5c5c61' : '#a1a1aa'}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      {/* Split Categories Filters */}
      <View className="mb-4">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4">
          {splits.map((split) => (
            <TouchableOpacity
              key={split}
              onPress={() => setSelectedSplit(split)}
              className="px-4 py-2 mr-2 border"
              style={{ 
                borderRadius: 100,
                backgroundColor: selectedSplit === split ? '#ea580c' : (isDark ? 'rgba(255, 255, 255, 0.02)' : '#ffffff'),
                borderColor: selectedSplit === split ? '#ea580c' : (isDark ? 'rgba(255, 255, 255, 0.08)' : '#cbd5e1')
              }}
            >
              <Text 
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ 
                  fontFamily: systemFont,
                  color: selectedSplit === split ? '#ffffff' : (isDark ? '#8e8e93' : '#71717a') 
                }}
              >
                {split}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Shared Workouts Feed */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchFeed(); }} tintColor="#ea580c" />
        }
      >
        {loading && feed.length === 0 ? (
          <View className="py-20 justify-center">
            <ActivityIndicator size="small" color="#ea580c" />
          </View>
        ) : filteredFeed.length === 0 ? (
          /* Glassmorphic Empty State */
          <View 
            className={`border p-8 items-center justify-center ${themeCard}`}
            style={{ borderRadius: 24 }}
          >
            <AlertCircle size={24} color="#5c5c61" strokeWidth={1.5} className="mb-2.5" />
            <Text 
              className={`font-bold text-[11px] uppercase tracking-wider mb-1.5 ${themeTextSub}`}
              style={{ fontFamily: systemFont }}
            >
              No Shared Blueprints Found
            </Text>
            <Text 
              className="text-zinc-500 text-[9px] text-center max-w-[210px] leading-relaxed font-semibold"
              style={{ fontFamily: systemFont }}
            >
              ADJUST SPLIT FILTER KEYWORDS TO SEARCH PUBLIC BLUEPRINT DATABASES.
            </Text>
          </View>
        ) : (
          filteredFeed.map((routine) => {
            const hasLiked = userLikedRoutineIds.includes(routine.id);
            const creator = routine.profiles?.username || 'community_user';

            return (
              /* Glass Card */
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
                {/* Creator Header */}
                <View className="flex-row justify-between items-center mb-3">
                  <View 
                    className={`border px-3 py-1 flex-row items-center gap-1.5 ${
                      isDark ? 'bg-zinc-900/60 border-white/5' : 'bg-zinc-100 border-zinc-200/60'
                    }`}
                    style={{ borderRadius: 100 }}
                  >
                    <User size={10} color="#ea580c" />
                    <Text 
                      className={`font-bold text-[9px] uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-700'}`}
                      style={{ fontFamily: systemFont }}
                    >
                      @{creator}
                    </Text>
                  </View>
                  
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedRoutine(routine);
                      setShowDetailModal(true);
                    }}
                    className={`border px-3 py-1 flex-row items-center gap-1 ${
                      isDark ? 'bg-zinc-900 border-white/5' : 'bg-zinc-100 border-zinc-200/60'
                    }`}
                    style={{ borderRadius: 100 }}
                  >
                    <Eye size={10} color="#ea580c" />
                    <Text 
                      className="text-[#ea580c] text-[9px] font-bold uppercase tracking-wider"
                      style={{ fontFamily: systemFont }}
                    >
                      Details
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Routine Info */}
                <Text 
                  className={`font-bold text-sm uppercase tracking-wide mt-1 ${themeTextHeader}`}
                  style={{ fontFamily: systemFont }}
                >
                  {routine.name}
                </Text>
                {routine.description ? (
                  <Text 
                    className={`text-[10px] mt-1.5 leading-relaxed font-medium ${themeTextSub}`}
                    style={{ fontFamily: systemFont }}
                    numberOfLines={2}
                  >
                    {routine.description}
                  </Text>
                ) : null}

                {/* Exercises preview tags */}
                <View className="flex-row flex-wrap gap-1.5 my-4">
                  {routine.routine_exercises.slice(0, 3).map((re, idx) => (
                    <View 
                      key={re.id || idx} 
                      className={`border px-2.5 py-0.5 ${
                        isDark ? 'bg-zinc-900/40 border-white/5' : 'bg-zinc-50 border-zinc-200'
                      }`}
                      style={{ borderRadius: 8 }}
                    >
                      <Text 
                        className={`text-[9px] font-semibold uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}
                        style={{ fontFamily: systemFont }}
                      >
                        {re.exercises.name} ({re.routine_sets.length}S)
                      </Text>
                    </View>
                  ))}
                  {routine.routine_exercises.length > 3 && (
                    <View 
                      className={`border px-2.5 py-0.5 ${
                        isDark ? 'bg-zinc-900/40 border-white/5' : 'bg-zinc-50 border-zinc-200'
                      }`}
                      style={{ borderRadius: 8 }}
                    >
                      <Text 
                        className="text-[9px] text-[#ea580c] font-bold uppercase tracking-wider"
                        style={{ fontFamily: systemFont }}
                      >
                        + {routine.routine_exercises.length - 3} more
                      </Text>
                    </View>
                  )}
                </View>

                {/* Action buttons */}
                <View 
                  className={`flex-row justify-between items-center border-t pt-3.5 ${themeDivider}`}
                >
                  {/* Upvote Button */}
                  <TouchableOpacity
                    onPress={() => handleLikeToggle(routine.id)}
                    activeOpacity={0.8}
                    className="flex-row items-center px-4 py-2 border gap-1.5"
                    style={{ 
                      borderRadius: 14,
                      backgroundColor: hasLiked ? 'rgba(234, 88, 12, 0.15)' : (isDark ? 'rgba(255, 255, 255, 0.02)' : '#ffffff'),
                      borderColor: hasLiked ? 'rgba(234, 88, 12, 0.3)' : (isDark ? 'rgba(255, 255, 255, 0.08)' : '#cbd5e1') 
                    }}
                  >
                    <Heart size={12} color={hasLiked ? '#ea580c' : '#8e8e93'} fill={hasLiked ? '#ea580c' : 'none'} strokeWidth={hasLiked ? 2.5 : 2} />
                    <Text 
                      className="text-[10px] font-bold uppercase tracking-wider"
                      style={{ 
                        fontFamily: systemFont,
                        color: hasLiked ? '#ea580c' : '#8e8e93' 
                      }}
                    >
                      {routine.likes_count}
                    </Text>
                  </TouchableOpacity>

                  {/* Import Button */}
                  <TouchableOpacity
                    onPress={() => handleImportRoutine(routine)}
                    disabled={importingRoutineId === routine.id}
                    activeOpacity={0.8}
                    className="bg-[#ea580c] py-2 px-4 flex-row items-center gap-1.5"
                    style={{ borderRadius: 14 }}
                  >
                    {importingRoutineId === routine.id ? (
                      <ActivityIndicator size="small" color="#ffffff" className="mx-4" />
                    ) : (
                      <>
                        <Download color="#ffffff" size={12} strokeWidth={2.5} />
                        <Text 
                          className="text-white font-bold text-[10px] uppercase tracking-wider"
                          style={{ fontFamily: systemFont }}
                        >
                          Import
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
        <View className="h-24" />
      </ScrollView>

      {/* ROUTINE DETAIL MODAL */}
      <Modal visible={showDetailModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView className="flex-1" style={{ backgroundColor: colors.dark }}>
          <BackgroundGlows />
          
          {/* Detail Header */}
          <View 
            className={`flex-row justify-between items-center px-4 py-4 border-b ${themeBorder} ${themeHeaderBg}`} 
          >
            <View className="flex-1 pr-4">
              <Text 
                className="text-[10px] text-zinc-500 font-semibold tracking-wide" 
                style={{ fontFamily: systemFont }}
              >
                Shared by @{selectedRoutine?.profiles?.username}
              </Text>
              <Text 
                className={`text-sm font-bold mt-1 tracking-wide ${themeTextHeader}`} 
                style={{ fontFamily: systemFont }}
              >
                {selectedRoutine?.name}
              </Text>
            </View>
            <TouchableOpacity 
              onPress={() => setShowDetailModal(false)} 
              className={`p-1.5 border ${isDark ? 'border-white/5 bg-zinc-900/80' : 'border-zinc-200 bg-zinc-100'}`} 
              style={{ borderRadius: 100 }}
            >
              <X size={14} color="#71717a" strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 px-4 pt-4">
            {/* Description */}
            {selectedRoutine?.description ? (
              /* Description Box */
              <View 
                className={`border p-4 mb-6 ${themeCard}`}
                style={{ borderRadius: 18 }}
              >
                <Text 
                  className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5" 
                  style={{ fontFamily: systemFont }}
                >
                  Description / Instructions
                </Text>
                <Text 
                  className={`text-xs leading-relaxed font-medium ${themeTextSub}`} 
                  style={{ fontFamily: systemFont }}
                >
                  {selectedRoutine.description}
                </Text>
              </View>
            ) : null}

            {/* List of exercises */}
            <Text 
              className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.18em] mb-4 ml-1" 
              style={{ fontFamily: systemFont }}
            >
              Preset Exercise Blueprint
            </Text>
            
            {selectedRoutine?.routine_exercises.map((ex, exIdx) => (
              /* Exercise Card */
              <View
                key={ex.id || exIdx}
                className={`border p-4 mb-4 ${themeCard}`}
                style={{ borderRadius: 20 }}
              >
                <View className={`flex-row justify-between items-center mb-3 pb-2.5 border-b ${themeDivider}`}>
                  <View>
                    <Text 
                      className={`font-bold text-sm uppercase tracking-wide ${themeTextHeader}`} 
                      style={{ fontFamily: systemFont }}
                    >
                      {ex.exercises.name}
                    </Text>
                    <Text 
                      className="text-[#ea580c] text-[9px] uppercase font-bold tracking-wider mt-0.5" 
                      style={{ fontFamily: systemFont }}
                    >
                      {ex.exercises.category}
                    </Text>
                  </View>
                  <View 
                    className={`border px-2.5 py-0.5 ${isDark ? 'bg-zinc-900/60 border-white/5' : 'bg-zinc-100 border-zinc-200'}`} 
                    style={{ borderRadius: 8 }}
                  >
                    <Text 
                      className="text-[9px] text-[#ea580c] font-bold uppercase"
                      style={{ fontFamily: systemFont }}
                    >
                      {ex.routine_sets.length} Sets
                    </Text>
                  </View>
                </View>

                {/* Target Sets Preview */}
                {ex.routine_sets.map((set, setIdx) => {
                  const displayWeight = displayWeightValue(set.weight || 0);
                  return (
                    <View 
                      key={setIdx} 
                      className={`flex-row items-center py-2 border-b ${themeDivider}`} 
                    >
                      <Text 
                        className="text-zinc-500 text-[10px] w-8 font-semibold" 
                        style={{ fontFamily: systemFont }}
                      >
                        {String(setIdx + 1).padStart(2, '0')}
                      </Text>
                      <Text 
                        className={`text-xs font-semibold flex-1 uppercase ${isDark ? 'text-zinc-400' : 'text-zinc-700'}`} 
                        style={{ fontFamily: systemFont }}
                      >
                        {set.reps} reps @ {displayWeight} {weightUnit}
                      </Text>
                      {set.notes ? (
                        <Text 
                          className="text-zinc-500 text-[10px] italic max-w-[120px] font-medium" 
                          style={{ fontFamily: systemFont }} 
                          numberOfLines={1}
                        >
                          {set.notes}
                        </Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ))}
          </ScrollView>

          {/* Import Button Footer */}
          <View 
            className={`px-4 py-4 border-t ${themeBorder} ${themeHeaderBg}`} 
          >
            <TouchableOpacity
              onPress={() => selectedRoutine && handleImportRoutine(selectedRoutine)}
              disabled={importingRoutineId === selectedRoutine?.id}
              activeOpacity={0.8}
              className="w-full bg-[#ea580c] py-3.5 items-center justify-center"
              style={{ borderRadius: 16 }}
            >
              {importingRoutineId === selectedRoutine?.id ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text 
                  className="text-white font-bold text-xs uppercase tracking-wider"
                  style={{ fontFamily: systemFont }}
                >
                  Import to Personal Library
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

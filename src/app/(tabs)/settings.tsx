import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Platform,
  Modal,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useUnits, WeightUnit, DistanceUnit, LengthUnit } from '../../context/UnitContext';
import { useWorkout } from '../../context/WorkoutContext';
import { supabase } from '../../lib/supabase';
import { importCSVWorkouts, CSVImportResult } from '../../utils/csv-importer';
import { BackgroundGlows } from '../../components/background-glows';
import { 
  User, 
  Settings, 
  Moon, 
  Flame, 
  Activity, 
  LogOut, 
  BookOpen, 
  ShieldCheck,
  Dumbbell,
  Database,
  ChevronRight,
  UploadCloud,
  CheckCircle,
  AlertTriangle,
  FileSpreadsheet,
  HelpCircle,
  X
} from 'lucide-react-native';

export default function SettingsScreen() {
  const { user, profile, signOut } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const {
    weightUnit,
    distanceUnit,
    lengthUnit,
    setWeightUnit,
    setDistanceUnit,
    setLengthUnit,
  } = useUnits();
  const { keepAwakeEnabled, setKeepAwakeEnabled } = useWorkout();

  const [loggingOut, setLoggingOut] = useState(false);
  const [workoutCount, setWorkoutCount] = useState(0);

  // CSV Importer States
  const [showImportModal, setShowImportModal] = useState(false);
  const [importState, setImportState] = useState<'idle' | 'picked' | 'importing' | 'success' | 'error'>('idle');
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [csvWeightUnit, setCsvWeightUnit] = useState<'kg' | 'lbs'>('kg');
  const [autoCreateRoutines, setAutoCreateRoutines] = useState(true);
  const [progressText, setProgressText] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [importSummary, setImportSummary] = useState<CSVImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Default the CSV weight unit to the user's current preference when the modal opens
  useEffect(() => {
    if (showImportModal) {
      setCsvWeightUnit(weightUnit);
      setImportState('idle');
      setSelectedFile(null);
      setImportSummary(null);
      setErrorMessage('');
    }
  }, [showImportModal, weightUnit]);

  const systemFont = Platform.OS === 'ios' ? 'System' : 'sans-serif';

  // Fetch some quick stats for the profile card
  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;
      try {
        const { count, error } = await supabase
          .from('workouts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        if (!error && count !== null) {
          setWorkoutCount(count);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchStats();
  }, [user]);

  const handleLogout = () => {
    Alert.alert(
      'Disconnect?',
      'Are you sure you want to terminate the active training session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            try {
              await signOut();
            } catch (e) {
              Alert.alert('Error', 'Failed to disconnect.');
            } finally {
              setLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/comma-separated-values', 'text/csv', 'text/plain', 'application/csv'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      setSelectedFile(asset);
      setImportState('picked');
    } catch (e) {
      Alert.alert('Error', 'Failed to select CSV file.');
    }
  };

  const handleStartImport = async () => {
    if (!selectedFile || !user) return;
    setImportState('importing');
    setProgressPercent(10);
    setProgressText('Reading CSV file content...');
    
    try {
      const csvText = await FileSystem.readAsStringAsync(selectedFile.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const result = await importCSVWorkouts(
        csvText,
        user.id,
        csvWeightUnit,
        autoCreateRoutines,
        (status, percent) => {
          setProgressText(status);
          setProgressPercent(percent);
        }
      );

      setImportSummary(result);
      setImportState('success');
      
      // Refresh user stats workout count
      const { count } = await supabase
        .from('workouts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (count !== null) {
        setWorkoutCount(count);
      }
    } catch (e: any) {
      console.error('CSV import failed:', e);
      setErrorMessage(e.message || 'An unexpected error occurred during CSV import.');
      setImportState('error');
    }
  };

  // Premium adaptive theme tokens
  const themeCard = isDark ? 'bg-zinc-950/70 border-white/5' : 'bg-white border-zinc-200/80';
  const themeTextHeader = isDark ? 'text-[#e2e2e5]' : 'text-zinc-900';
  const themeTextSub = isDark ? 'text-zinc-400' : 'text-zinc-600';
  const themeTextMuted = isDark ? 'text-zinc-500' : 'text-zinc-400';
  const themeDivider = isDark ? 'border-white/5' : 'border-zinc-200/60';
  const themeIconBg = isDark ? 'bg-zinc-900/60 border-white/5' : 'bg-zinc-100 border-zinc-200';
  const themeSegmentBg = isDark ? 'bg-zinc-900 border-white/5' : 'bg-zinc-100 border-zinc-200/60';
  const themeBorder = isDark ? 'border-white/5' : 'border-zinc-200/80';
  const themeHeaderBg = isDark ? 'bg-zinc-950/60 border-white/5' : 'bg-zinc-100/90 border-zinc-200';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.dark }}>
      <BackgroundGlows />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 140 }}
      >
        {/* Header */}
        <View className={`mb-6 border-b pb-4 ${themeDivider}`}>
          <Text 
            className="text-zinc-500 text-xs tracking-wide font-bold"
            style={{ fontFamily: systemFont }}
          >
            Preferences
          </Text>
          <Text 
            className={`text-xl font-bold mt-1.5 ${themeTextHeader}`}
            style={{ fontFamily: systemFont }}
          >
            Settings
          </Text>
        </View>

        {/* User Profile Summary Card */}
        <View
          className={`border p-5 flex-row items-center mb-6 ${themeCard}`}
          style={{
            borderRadius: 24,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: isDark ? 0.35 : 0.05,
            shadowRadius: 16,
            elevation: 5,
          }}
        >
          {/* Glowing Glass Avatar Circle */}
          <View
            className={`w-12 h-12 border items-center justify-center mr-4 ${
              isDark ? 'bg-zinc-900 border-[#ea580c]/30' : 'bg-orange-50 border-[#ea580c]/45'
            }`}
            style={{
              borderRadius: 24,
              shadowColor: '#ea580c',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: isDark ? 0.3 : 0.1,
              shadowRadius: 6,
            }}
          >
            <User size={20} color="#ea580c" strokeWidth={1.8} />
          </View>

          <View className="flex-1">
            <Text 
              className={`font-bold text-base uppercase tracking-wide ${themeTextHeader}`}
              style={{ fontFamily: systemFont }}
            >
              @{profile?.username || 'user'}
            </Text>
            <Text
              className={`text-xs font-bold mt-0.5 uppercase tracking-wider ${themeTextMuted}`}
              style={{ fontFamily: systemFont }}
              numberOfLines={1}
            >
              {user?.email}
            </Text>
            <View
              className="border border-[#ea580c]/20 bg-[#ea580c]/5 px-3 py-1 mt-2.5 self-start"
              style={{ borderRadius: 8 }}
            >
              <Text 
                className="text-xs font-bold text-[#ea580c] uppercase tracking-wider"
                style={{ fontFamily: systemFont }}
              >
                Logged Sessions: {workoutCount}
              </Text>
            </View>
          </View>
        </View>

        {/* Display Settings Section */}
        <View className="mb-6">
          <Text 
            className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 mb-3 ml-1"
            style={{ fontFamily: systemFont }}
          >
            DISPLAY & THEME
          </Text>
          <View
            className={`border p-4 ${themeCard}`}
            style={{
              borderRadius: 24,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: isDark ? 0.3 : 0.05,
              shadowRadius: 12,
              elevation: 4,
            }}
          >
            <View className="flex-row justify-between items-center py-1">
              <View className="flex-row items-center flex-1 pr-4">
                <View className={`w-8 h-8 items-center justify-center mr-3 ${themeIconBg}`} style={{ borderRadius: 10 }}>
                  <Moon size={15} color="#ea580c" />
                </View>
                <View className="flex-1">
                  <Text 
                    className={`font-bold text-sm uppercase tracking-wide ${themeTextHeader}`}
                    style={{ fontFamily: systemFont }}
                  >
                    Dark Theme
                  </Text>
                  <Text
                    className={`text-[9px] font-semibold mt-0.5 uppercase tracking-wider ${themeTextSub}`}
                    style={{ fontFamily: systemFont }}
                  >
                    Phosphor emissive substrate
                  </Text>
                </View>
              </View>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.08)', true: '#ea580c' }}
                thumbColor={Platform.OS === 'android' ? '#ffffff' : ''}
              />
            </View>
          </View>
        </View>

        {/* Workout Log Preferences Section */}
        <View className="mb-6">
          <Text 
            className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 mb-3 ml-1"
            style={{ fontFamily: systemFont }}
          >
            WORKOUT RUNTIME PREFS
          </Text>
          <View
            className={`border p-4 ${themeCard}`}
            style={{
              borderRadius: 24,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: isDark ? 0.3 : 0.05,
              shadowRadius: 12,
              elevation: 4,
            }}
          >
            <View className="flex-row justify-between items-center py-1">
              <View className="flex-row items-center flex-1 pr-4">
                <View className={`w-8 h-8 items-center justify-center mr-3 ${themeIconBg}`} style={{ borderRadius: 10 }}>
                  <Flame size={15} color="#ea580c" />
                </View>
                <View className="flex-1">
                  <Text 
                    className={`font-bold text-sm uppercase tracking-wide ${themeTextHeader}`}
                    style={{ fontFamily: systemFont }}
                  >
                    Prevent Sleep
                  </Text>
                  <Text
                    className={`text-[9px] font-semibold mt-0.5 uppercase tracking-wider ${themeTextSub}`}
                    style={{ fontFamily: systemFont }}
                  >
                    Keep screen alive during session
                  </Text>
                </View>
              </View>
              <Switch
                value={keepAwakeEnabled}
                onValueChange={setKeepAwakeEnabled}
                trackColor={{ false: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.08)', true: '#ea580c' }}
                thumbColor={Platform.OS === 'android' ? '#ffffff' : ''}
              />
            </View>
          </View>
        </View>

        {/* Measurement Units Preferences Section */}
        <View className="mb-6">
          <Text 
            className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 mb-3 ml-1"
            style={{ fontFamily: systemFont }}
          >
            TELEMETRY SCALING UNITS
          </Text>
          <View
            className={`border p-4 gap-4 ${themeCard}`}
            style={{
              borderRadius: 24,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: isDark ? 0.3 : 0.05,
              shadowRadius: 12,
              elevation: 4,
            }}
          >
            {/* Weight Unit Selection */}
            <View className="flex-row justify-between items-center py-1">
              <View className="flex-row items-center flex-1 pr-4">
                <View className={`w-8 h-8 items-center justify-center mr-3 ${themeIconBg}`} style={{ borderRadius: 10 }}>
                  <Dumbbell size={15} color="#ea580c" />
                </View>
                <View className="flex-1">
                  <Text 
                    className={`font-bold text-sm uppercase tracking-wide ${themeTextHeader}`}
                    style={{ fontFamily: systemFont }}
                  >
                    Weight Unit
                  </Text>
                  <Text
                    className={`text-[9px] font-semibold mt-0.5 uppercase tracking-wider ${themeTextSub}`}
                    style={{ fontFamily: systemFont }}
                  >
                    Tonnage logs & 1RM formulas
                  </Text>
                </View>
              </View>

              {/* Glass Rounded Segment Control */}
              <View
                className={`flex-row border p-0.5 w-28 ${themeSegmentBg}`}
                style={{ borderRadius: 100 }}
              >
                {(['kg', 'lbs'] as WeightUnit[]).map((unit) => (
                  <TouchableOpacity
                    key={unit}
                    onPress={() => setWeightUnit(unit)}
                    className="flex-1 py-1.5 items-center justify-center"
                    style={{
                      borderRadius: 100,
                      backgroundColor: weightUnit === unit ? '#ea580c' : 'transparent',
                    }}
                  >
                    <Text
                      className="text-[9px] font-bold uppercase tracking-wider"
                      style={{ 
                        fontFamily: systemFont,
                        color: weightUnit === unit ? '#ffffff' : (isDark ? '#8e8e93' : '#71717a') 
                      }}
                    >
                      {unit}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Distance Unit Selection */}
            <View
              className={`flex-row justify-between items-center py-1 border-t pt-4 ${themeDivider}`}
            >
              <View className="flex-row items-center flex-1 pr-4">
                <View className={`w-8 h-8 items-center justify-center mr-3 ${themeIconBg}`} style={{ borderRadius: 10 }}>
                  <Activity size={15} color="#ea580c" />
                </View>
                <View className="flex-1">
                  <Text 
                    className={`font-bold text-sm uppercase tracking-wide ${themeTextHeader}`}
                    style={{ fontFamily: systemFont }}
                  >
                    Distance Unit
                  </Text>
                  <Text
                    className={`text-[9px] font-semibold mt-0.5 uppercase tracking-wider ${themeTextSub}`}
                    style={{ fontFamily: systemFont }}
                  >
                    Running & cardio speed trackers
                  </Text>
                </View>
              </View>

              {/* Glass Rounded Segment Control */}
              <View
                className={`flex-row border p-0.5 w-28 ${themeSegmentBg}`}
                style={{ borderRadius: 100 }}
              >
                {(['km', 'mi'] as DistanceUnit[]).map((unit) => (
                  <TouchableOpacity
                    key={unit}
                    onPress={() => setDistanceUnit(unit)}
                    className="flex-1 py-1.5 items-center justify-center"
                    style={{
                      borderRadius: 100,
                      backgroundColor: distanceUnit === unit ? '#ea580c' : 'transparent',
                    }}
                  >
                    <Text
                      className="text-[9px] font-bold uppercase tracking-wider"
                      style={{ 
                        fontFamily: systemFont,
                        color: distanceUnit === unit ? '#ffffff' : (isDark ? '#8e8e93' : '#71717a') 
                      }}
                    >
                      {unit}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Length Unit Selection */}
            <View
              className={`flex-row justify-between items-center py-1 border-t pt-4 ${themeDivider}`}
            >
              <View className="flex-row items-center flex-1 pr-4">
                <View className={`w-8 h-8 items-center justify-center mr-3 ${themeIconBg}`} style={{ borderRadius: 10 }}>
                  <BookOpen size={15} color="#ea580c" />
                </View>
                <View className="flex-1">
                  <Text 
                    className={`font-bold text-sm uppercase tracking-wide ${themeTextHeader}`}
                    style={{ fontFamily: systemFont }}
                  >
                    Body Measures
                  </Text>
                  <Text
                    className={`text-[9px] font-semibold mt-0.5 uppercase tracking-wider ${themeTextSub}`}
                    style={{ fontFamily: systemFont }}
                  >
                    Height & body tape parameters
                  </Text>
                </View>
              </View>

              {/* Glass Rounded Segment Control */}
              <View
                className={`flex-row border p-0.5 w-28 ${themeSegmentBg}`}
                style={{ borderRadius: 100 }}
              >
                {(['cm', 'in'] as LengthUnit[]).map((unit) => (
                  <TouchableOpacity
                    key={unit}
                    onPress={() => setLengthUnit(unit)}
                    className="flex-1 py-1.5 items-center justify-center"
                    style={{
                      borderRadius: 100,
                      backgroundColor: lengthUnit === unit ? '#ea580c' : 'transparent',
                    }}
                  >
                    <Text
                      className="text-[9px] font-bold uppercase tracking-wider"
                      style={{ 
                        fontFamily: systemFont,
                        color: lengthUnit === unit ? '#ffffff' : (isDark ? '#8e8e93' : '#71717a') 
                      }}
                    >
                      {unit}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Data Import Section */}
        <View className="mb-6">
          <Text 
            className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 mb-3 ml-1"
            style={{ fontFamily: systemFont }}
          >
            DATA UTILITIES
          </Text>
          <View
            className={`border p-4 ${themeCard}`}
            style={{
              borderRadius: 24,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: isDark ? 0.3 : 0.05,
              shadowRadius: 12,
              elevation: 4,
            }}
          >
            <TouchableOpacity
              onPress={() => setShowImportModal(true)}
              className="flex-row items-center justify-between py-1"
            >
              <View className="flex-row items-center flex-1 pr-4">
                <View className={`w-8 h-8 items-center justify-center mr-3 ${themeIconBg}`} style={{ borderRadius: 10 }}>
                  <Database size={15} color="#ea580c" />
                </View>
                <View className="flex-1">
                  <Text 
                    className={`font-bold text-sm uppercase tracking-wide ${themeTextHeader}`}
                    style={{ fontFamily: systemFont }}
                  >
                    Import Training CSV
                  </Text>
                  <Text
                    className={`text-[9px] font-semibold mt-0.5 uppercase tracking-wider ${themeTextSub}`}
                    style={{ fontFamily: systemFont }}
                  >
                    Load history & routines from Bolt / Hevy
                  </Text>
                </View>
              </View>
              <ChevronRight size={16} color={isDark ? '#8e8e93' : '#71717a'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Support & Legal Info */}
        <View
          className={`mb-6 border p-4 flex-row items-center ${themeCard}`}
          style={{
            borderRadius: 24,
          }}
        >
          <ShieldCheck size={14} color="#ea580c" className="mr-2" />
          <Text 
            className="text-zinc-500 text-[9px] font-bold uppercase tracking-widest"
            style={{ fontFamily: systemFont }}
          >
            FitBuddy Telemetry v4.0.0 (SDK 56)
          </Text>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          onPress={handleLogout}
          disabled={loggingOut}
          className={`py-4 items-center justify-center mb-24 flex-row gap-2 border ${
            isDark ? 'bg-red-950/10 border-red-500/20' : 'bg-red-50 border-red-200'
          }`}
          style={{ borderRadius: 16 }}
        >
          {loggingOut ? (
            <ActivityIndicator color="#ff453a" />
          ) : (
            <>
              <LogOut size={14} color="#ff453a" strokeWidth={2} />
              <Text 
                className="text-[#ff453a] font-semibold text-xs tracking-wide"
                style={{ fontFamily: systemFont }}
              >
                Log Out
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* CSV IMPORT MODAL */}
      <Modal
        visible={showImportModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          if (importState !== 'importing') {
            setShowImportModal(false);
          }
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.dark }}>
          <BackgroundGlows />
          
          {/* Header */}
          <View className={`flex-row justify-between items-center px-4 py-4 border-b ${themeBorder} ${themeHeaderBg}`}>
            <View>
              <Text className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">Data Utility</Text>
              <Text className={`text-sm font-bold mt-1 ${themeTextHeader}`}>Import Training CSV</Text>
            </View>
            {importState !== 'importing' && (
              <TouchableOpacity
                onPress={() => setShowImportModal(false)}
                style={{
                  padding: 6,
                  borderWidth: 1,
                  borderRadius: 100,
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#e4e4e7',
                  backgroundColor: isDark ? 'rgba(24, 24, 27, 0.8)' : '#f4f4f5',
                }}
              >
                <X size={14} color="#71717a" />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView 
            style={{ flex: 1, backgroundColor: 'transparent' }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 60 }}
          >
            {/* IDLE STATE */}
            {importState === 'idle' && (
              <View className="items-center py-8">
                <View className={`w-16 h-16 items-center justify-center mb-6 ${themeIconBg}`} style={{ borderRadius: 24 }}>
                  <FileSpreadsheet size={32} color="#ea580c" />
                </View>
                
                <Text className={`text-base font-bold text-center mb-3 ${themeTextHeader}`}>
                  Import Training History
                </Text>
                
                <Text className={`text-xs text-center leading-relaxed mb-8 px-4 ${themeTextSub}`}>
                  Upload a standard workout export CSV (from Bolt, Hevy, or Strong) to sync your historical workouts, exercises, and routines.
                </Text>

                <TouchableOpacity
                  onPress={handlePickFile}
                  className="w-full py-4 bg-[#ea580c] items-center justify-center flex-row gap-2"
                  style={{ borderRadius: 16 }}
                >
                  <UploadCloud size={16} color="#ffffff" strokeWidth={2.5} />
                  <Text className="text-white font-bold text-sm uppercase tracking-wider">Select CSV File</Text>
                </TouchableOpacity>

                <View className={`border p-4 mt-8 flex-row gap-3 ${themeCard}`} style={{ borderRadius: 18, width: '100%' }}>
                  <HelpCircle size={16} color="#ea580c" className="mt-0.5" />
                  <View className="flex-1">
                    <Text className={`font-bold text-xs ${themeTextHeader}`}>Expected CSV Columns</Text>
                    <Text className={`text-[10px] leading-relaxed mt-1.5 ${themeTextSub}`}>
                      Required: Date, Workout Name, Exercise Name, Set, Weight, Reps.
                    </Text>
                    <Text className={`text-[10px] leading-relaxed mt-1 ${themeTextSub}`}>
                      Optional: Distance, Duration, Notes.
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* PICKED STATE */}
            {importState === 'picked' && (
              <View className="py-4">
                {/* File Information Card */}
                <View className={`border p-4 mb-6 flex-row items-center ${themeCard}`} style={{ borderRadius: 20 }}>
                  <View className="w-10 h-10 bg-orange-500/10 items-center justify-center mr-3" style={{ borderRadius: 12 }}>
                    <FileSpreadsheet size={20} color="#ea580c" />
                  </View>
                  <View className="flex-1 pr-2">
                    <Text className={`font-bold text-xs ${themeTextHeader}`} numberOfLines={1}>
                      {selectedFile?.name}
                    </Text>
                    <Text className={`text-[9px] font-semibold mt-0.5 uppercase tracking-wider ${themeTextMuted}`}>
                      Size: {selectedFile?.size ? `${(selectedFile.size / 1024).toFixed(1)} KB` : 'Unknown'}
                    </Text>
                  </View>
                </View>

                {/* Configuration Options */}
                <Text className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 mb-3 ml-1">
                  IMPORT PREFERENCES
                </Text>

                <View className={`border p-5 gap-5 mb-8 ${themeCard}`} style={{ borderRadius: 24 }}>
                  {/* Weight Unit Preference */}
                  <View className="flex-row justify-between items-center">
                    <View className="flex-1 pr-4">
                      <Text className={`font-bold text-xs uppercase tracking-wide ${themeTextHeader}`}>
                        CSV Weight Unit
                      </Text>
                      <Text className={`text-[9px] font-semibold mt-0.5 uppercase tracking-wider ${themeTextSub}`}>
                        Interpret weight values in the CSV as KG or LBS
                      </Text>
                    </View>
                    <View className={`flex-row border p-0.5 w-24 ${themeSegmentBg}`} style={{ borderRadius: 100 }}>
                      {(['kg', 'lbs'] as const).map((unit) => (
                        <TouchableOpacity
                          key={unit}
                          onPress={() => setCsvWeightUnit(unit)}
                          className="flex-1 py-1 items-center justify-center"
                          style={{
                            borderRadius: 100,
                            backgroundColor: csvWeightUnit === unit ? '#ea580c' : 'transparent',
                          }}
                        >
                          <Text
                            className="text-[9px] font-bold uppercase tracking-wider"
                            style={{ color: csvWeightUnit === unit ? '#ffffff' : (isDark ? '#8e8e93' : '#71717a') }}
                          >
                            {unit}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Auto Create Routines */}
                  <View className={`flex-row justify-between items-center border-t pt-4 ${themeDivider}`}>
                    <View className="flex-1 pr-4">
                      <Text className={`font-bold text-xs uppercase tracking-wide ${themeTextHeader}`}>
                        Create Routines
                      </Text>
                      <Text className={`text-[9px] font-semibold mt-0.5 uppercase tracking-wider ${themeTextSub}`}>
                        Auto-generate templates from unique workout structures
                      </Text>
                    </View>
                    <Switch
                      value={autoCreateRoutines}
                      onValueChange={setAutoCreateRoutines}
                      trackColor={{ false: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.08)', true: '#ea580c' }}
                      thumbColor={Platform.OS === 'android' ? '#ffffff' : ''}
                    />
                  </View>
                </View>

                {/* Import Buttons */}
                <TouchableOpacity
                  onPress={handleStartImport}
                  className="w-full py-4 bg-[#ea580c] items-center justify-center"
                  style={{ borderRadius: 16 }}
                >
                  <Text className="text-white font-bold text-sm uppercase tracking-wider">Start Import</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handlePickFile}
                  className={`w-full py-4 mt-3 items-center justify-center border ${isDark ? 'bg-zinc-900 border-white/5' : 'bg-zinc-100 border-zinc-200'}`}
                  style={{ borderRadius: 16 }}
                >
                  <Text className={`font-bold text-xs uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    Select Different File
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* IMPORTING STATE */}
            {importState === 'importing' && (
              <View className="items-center py-12">
                <ActivityIndicator size="large" color="#ea580c" className="mb-6" />
                
                <Text className={`text-sm font-bold text-center mb-1 ${themeTextHeader}`}>
                  Importing Workout Data
                </Text>
                
                <Text className="text-[#ea580c] text-xs font-bold text-center uppercase tracking-wider mb-8">
                  {progressPercent}%
                </Text>

                {/* Custom Premium Progress Bar */}
                <View className={`w-full h-2 rounded-full overflow-hidden mb-6 ${isDark ? 'bg-zinc-900' : 'bg-zinc-100'}`}>
                  <View 
                    className="h-full bg-[#ea580c] rounded-full"
                    style={{ width: `${progressPercent}%` }}
                  />
                </View>

                <Text className={`text-xs text-center px-4 mb-10 ${themeTextSub}`} numberOfLines={2}>
                  {progressText}
                </Text>

                <View className={`border p-4 flex-row gap-3 ${isDark ? 'bg-orange-950/10 border-orange-500/10' : 'bg-orange-50 border-orange-200'}`} style={{ borderRadius: 18 }}>
                  <AlertTriangle size={16} color="#ea580c" className="mt-0.5" />
                  <View className="flex-1">
                    <Text className="text-[#ea580c] font-bold text-xs uppercase">Crucial Operation</Text>
                    <Text className={`text-[10px] leading-relaxed mt-1 ${themeTextSub}`}>
                      Please keep the application open and ensure your internet connection remains active during this synchronization process.
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* SUCCESS STATE */}
            {importState === 'success' && (
              <View className="items-center py-6">
                <View className="w-16 h-16 bg-emerald-500/10 items-center justify-center mb-6" style={{ borderRadius: 24 }}>
                  <CheckCircle size={32} color="#10b981" />
                </View>

                <Text className={`text-base font-bold text-center mb-2 ${themeTextHeader}`}>
                  Import Completed!
                </Text>
                
                <Text className={`text-xs text-center mb-8 ${themeTextSub}`}>
                  Your workout logs and routines have been successfully synchronized with Supabase.
                </Text>

                {/* Summary Grid */}
                <Text className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 mb-3 self-start ml-1">
                  IMPORT STATISTICS
                </Text>

                <View className={`border p-4 w-full gap-4 mb-8 ${themeCard}`} style={{ borderRadius: 24 }}>
                  <View className="flex-row justify-between items-center">
                    <Text className={`text-xs font-semibold ${themeTextSub}`}>Workouts Logged</Text>
                    <Text className={`text-xs font-bold ${themeTextHeader}`}>{importSummary?.workoutsImported}</Text>
                  </View>
                  <View className={`flex-row justify-between items-center border-t pt-3.5 ${themeDivider}`}>
                    <Text className={`text-xs font-semibold ${themeTextSub}`}>Sets Recorded</Text>
                    <Text className={`text-xs font-bold ${themeTextHeader}`}>{importSummary?.setsImported}</Text>
                  </View>
                  <View className={`flex-row justify-between items-center border-t pt-3.5 ${themeDivider}`}>
                    <Text className={`text-xs font-semibold ${themeTextSub}`}>Custom Exercises Created</Text>
                    <Text className={`text-xs font-bold ${themeTextHeader}`}>{importSummary?.exercisesCreated}</Text>
                  </View>
                  <View className={`flex-row justify-between items-center border-t pt-3.5 ${themeDivider}`}>
                    <Text className={`text-xs font-semibold ${themeTextSub}`}>Routines Created</Text>
                    <Text className={`text-xs font-bold ${themeTextHeader}`}>{importSummary?.routinesCreated}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => setShowImportModal(false)}
                  className="w-full py-4 bg-[#ea580c] items-center justify-center"
                  style={{ borderRadius: 16 }}
                >
                  <Text className="text-white font-bold text-sm uppercase tracking-wider">Done</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ERROR STATE */}
            {importState === 'error' && (
              <View className="items-center py-6">
                <View className="w-16 h-16 bg-red-500/10 items-center justify-center mb-6" style={{ borderRadius: 24 }}>
                  <AlertTriangle size={32} color="#ef4444" />
                </View>

                <Text className={`text-base font-bold text-center mb-2 ${themeTextHeader}`}>
                  Import Failed
                </Text>
                
                <Text className="text-zinc-500 text-xs text-center mb-8">
                  An error occurred while parsing or saving the CSV data.
                </Text>

                {/* Error Log Box */}
                <View className={`border p-4 w-full bg-red-500/5 ${isDark ? 'border-red-500/20' : 'border-red-200'} mb-8`} style={{ borderRadius: 20 }}>
                  <Text className="text-[#ef4444] text-[11px] leading-relaxed font-mono">
                    {errorMessage}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => setImportState('idle')}
                  className="w-full py-4 bg-[#ea580c] items-center justify-center"
                  style={{ borderRadius: 16 }}
                >
                  <Text className="text-white font-bold text-sm uppercase tracking-wider">Try Again</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setShowImportModal(false)}
                  className={`w-full py-4 mt-3 items-center justify-center border ${isDark ? 'bg-zinc-900 border-white/5' : 'bg-zinc-100 border-zinc-200'}`}
                  style={{ borderRadius: 16 }}
                >
                  <Text className={`font-bold text-xs uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    Close
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

import { supabase } from '../lib/supabase';

export type CSVImportResult = {
  workoutsImported: number;
  exercisesCreated: number;
  routinesCreated: number;
  setsImported: number;
};

// 1. O(N) State-Machine CSV Parser
export function parseCSV(csvText: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentValue = '';

  // Clean carriage returns and ensure a trailing newline for uniform parsing
  const cleanText = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n') + '\n';

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          currentValue += '"';
          i++; // Skip next quote
        } else {
          // End of quoted section
          inQuotes = false;
        }
      } else {
        currentValue += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(currentValue);
        currentValue = '';
      } else if (char === '\n') {
        // Handle trailing comma or empty line
        if (currentValue !== '' || row.length > 0) {
          row.push(currentValue);
          lines.push(row);
        }
        row = [];
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
  }
  return lines;
}

// 2. Muscle Group Guesser based on exercise name keywords
export function guessCategory(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('press') && (lower.includes('bench') || lower.includes('chest') || lower.includes('incline') || lower.includes('decline') || lower.includes('fly') || lower.includes('pec'))) return 'Chest';
  if (lower.includes('row') || lower.includes('pull') || lower.includes('lat') || lower.includes('deadlift') || lower.includes('chin') || lower.includes('back') || lower.includes('shrug')) return 'Back';
  if (lower.includes('squat') || lower.includes('leg') || lower.includes('calf') || lower.includes('hamstring') || lower.includes('quad') || lower.includes('lunge') || lower.includes('press') && lower.includes('leg') || lower.includes('calf') || lower.includes('extension') && lower.includes('leg') || lower.includes('curl') && lower.includes('leg')) return 'Legs';
  if (lower.includes('press') && (lower.includes('shoulder') || lower.includes('overhead') || lower.includes('military')) || lower.includes('lateral') || lower.includes('raise') || lower.includes('delt') || lower.includes('rear fly')) return 'Shoulders';
  if (lower.includes('curl') || lower.includes('bicep') || lower.includes('hammer')) return 'Biceps';
  if (lower.includes('extension') && lower.includes('tricep') || lower.includes('pushdown') || lower.includes('skull') || lower.includes('dip') || lower.includes('kickback')) return 'Triceps';
  if (lower.includes('crunch') || lower.includes('situp') || lower.includes('plank') || lower.includes('core') || lower.includes('abs') || lower.includes('abdominal') || lower.includes('leg raise') || lower.includes('hanging')) return 'Core';
  if (lower.includes('run') || lower.includes('treadmill') || lower.includes('cycle') || lower.includes('bike') || lower.includes('cardio') || lower.includes('rowing') || lower.includes('elliptical') || lower.includes('swim') || lower.includes('jump rope') || lower.includes('stair')) return 'Cardio';
  return 'Other';
}

// Structuring types for parsing
type CSVSet = {
  setNum: number;
  weight: number;
  reps: number;
  distance: number;
  duration: number;
  notes: string;
};

type CSVExercise = {
  name: string;
  sets: CSVSet[];
};

type CSVWorkout = {
  date: string; // ISO string
  name: string;
  exercises: CSVExercise[];
};

// 3. Main Importer logic
export async function importCSVWorkouts(
  csvText: string,
  userId: string,
  weightUnitPreference: 'kg' | 'lbs',
  autoCreateRoutines: boolean,
  onProgress: (status: string, percent: number) => void
): Promise<CSVImportResult> {
  const result: CSVImportResult = {
    workoutsImported: 0,
    exercisesCreated: 0,
    routinesCreated: 0,
    setsImported: 0,
  };

  onProgress('Parsing CSV data...', 5);
  const parsedLines = parseCSV(csvText);

  if (parsedLines.length < 2) {
    throw new Error('CSV is empty or missing data rows.');
  }

  // Detect header offsets
  const headers = parsedLines[0].map((h) => h.toLowerCase().trim());
  
  const dateIdx = headers.indexOf('date');
  const workoutNameIdx = headers.indexOf('workout name');
  const exerciseNameIdx = headers.indexOf('exercise name');
  const setIdx = headers.indexOf('set');
  const weightIdx = headers.indexOf('weight');
  const repsIdx = headers.indexOf('reps');
  
  // Optional columns
  const distanceIdx = headers.indexOf('distance');
  const durationIdx = headers.indexOf('duration');
  const notesIdx = headers.indexOf('notes');

  // Validate required headers
  if (dateIdx === -1 || workoutNameIdx === -1 || exerciseNameIdx === -1 || setIdx === -1 || weightIdx === -1 || repsIdx === -1) {
    throw new Error(
      `Invalid CSV headers. Missing one or more required columns: "Date", "Workout Name", "Exercise Name", "Set", "Weight", "Reps". Detected columns: ${parsedLines[0].join(', ')}`
    );
  }

  onProgress('Grouping records by workout session...', 15);

  // Group rows into workouts
  const workoutsMap = new Map<string, CSVWorkout>();

  for (let i = 1; i < parsedLines.length; i++) {
    const row = parsedLines[i];
    // Skip empty or malformed rows
    if (row.length <= Math.max(dateIdx, workoutNameIdx, exerciseNameIdx, setIdx, weightIdx, repsIdx)) {
      continue;
    }

    const rawDate = row[dateIdx]?.trim();
    const workoutName = row[workoutNameIdx]?.trim() || 'Imported Workout';
    const exerciseName = row[exerciseNameIdx]?.trim();
    const rawSet = row[setIdx]?.trim();
    const rawWeight = row[weightIdx]?.trim();
    const rawReps = row[repsIdx]?.trim();

    if (!rawDate || !exerciseName) continue;

    // Convert date to ISO string
    let isoDate: string;
    try {
      // Handle timestamps like "2024-06-27 13:17:11"
      isoDate = new Date(rawDate.replace(/"/g, '')).toISOString();
    } catch (e) {
      isoDate = new Date().toISOString(); // fallback
    }

    // Unique workout session identifier: ISO Date + Workout Name
    const sessionKey = `${isoDate}___${workoutName}`;

    if (!workoutsMap.has(sessionKey)) {
      workoutsMap.set(sessionKey, {
        date: isoDate,
        name: workoutName,
        exercises: [],
      });
    }

    const workout = workoutsMap.get(sessionKey)!;

    // Find or create exercise within this workout
    let exercise = workout.exercises.find((ex) => ex.name.toLowerCase() === exerciseName.toLowerCase());
    if (!exercise) {
      exercise = {
        name: exerciseName,
        sets: [],
      };
      workout.exercises.push(exercise);
    }

    // Parse set values
    const setNum = parseInt(rawSet, 10) || 1;
    const weight = parseFloat(rawWeight) || 0;
    const reps = parseInt(rawReps, 10) || 0;
    const distance = distanceIdx !== -1 ? parseFloat(row[distanceIdx]) || 0 : 0;
    const duration = durationIdx !== -1 ? parseFloat(row[durationIdx]) || 0 : 0;
    const notes = notesIdx !== -1 ? row[notesIdx]?.trim() || '' : '';

    exercise.sets.push({
      setNum,
      weight,
      reps,
      distance,
      duration,
      notes,
    });
  }

  const workoutsList = Array.from(workoutsMap.values());
  // Sort workouts by date ascending to import them chronologically
  workoutsList.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (workoutsList.length === 0) {
    throw new Error('No valid workout records found in the CSV.');
  }

  // 4. Exercise Mapping & Custom Exercise Batch Creation
  onProgress('Syncing exercise definitions...', 30);

  // Fetch all existing exercises (standard + user's custom exercises)
  const { data: dbExercises, error: dbExError } = await supabase
    .from('exercises')
    .select('id, name');
  if (dbExError) throw dbExError;

  // Create a lowercase name-to-id mapping
  const exerciseMap = new Map<string, string>();
  dbExercises?.forEach((ex) => {
    exerciseMap.set(ex.name.toLowerCase().trim(), ex.id);
  });

  // Identify unique exercise names in CSV that are NOT in the database
  const csvUniqueExerciseNames = new Set<string>();
  workoutsList.forEach((w) => {
    w.exercises.forEach((ex) => {
      csvUniqueExerciseNames.add(ex.name.trim());
    });
  });

  const missingExercises = Array.from(csvUniqueExerciseNames).filter(
    (name) => !exerciseMap.has(name.toLowerCase())
  );

  // Batch insert new custom exercises
  if (missingExercises.length > 0) {
    onProgress(`Creating ${missingExercises.length} custom exercises...`, 35);
    
    const newExercisesToInsert = missingExercises.map((name) => {
      const customId = `custom-csv-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      return {
        id: customId,
        name: name,
        category: guessCategory(name),
        instructions: ['type:dumbbell'], // default equipment type
        user_id: userId,
      };
    });

    const { error: insertExError } = await supabase
      .from('exercises')
      .insert(newExercisesToInsert);

    if (insertExError) throw insertExError;

    // Add newly created exercises to mapping list
    newExercisesToInsert.forEach((ex) => {
      exerciseMap.set(ex.name.toLowerCase(), ex.id);
    });
    result.exercisesCreated = newExercisesToInsert.length;
  }

  // 5. Progressively Insert Workouts, Exercises, and Sets
  const totalWorkouts = workoutsList.length;
  let setsCounter = 0;

  for (let wIdx = 0; wIdx < totalWorkouts; wIdx++) {
    const w = workoutsList[wIdx];
    const progressPercent = 40 + Math.floor((wIdx / totalWorkouts) * 50);
    onProgress(`Importing: ${w.name} (${wIdx + 1}/${totalWorkouts})...`, progressPercent);

    // 1. Insert Workout Header
    const { data: workoutData, error: wError } = await supabase
      .from('workouts')
      .insert({
        user_id: userId,
        name: w.name,
        started_at: w.date,
        completed_at: w.date, // simple historical import puts same start/end
        notes: 'Imported from training CSV.',
      })
      .select()
      .single();

    if (wError) throw wError;
    const workoutId = workoutData.id;

    // 2. Prepare & Batch Insert Exercises for this Workout
    const exercisesToInsert = w.exercises.map((ex, exIdx) => {
      const exerciseId = exerciseMap.get(ex.name.toLowerCase().trim());
      if (!exerciseId) {
        throw new Error(`Exercise "${ex.name}" mapping failed.`);
      }
      return {
        workout_id: workoutId,
        exercise_id: exerciseId,
        order_index: exIdx,
        notes: '',
      };
    });

    const { data: insertedExercises, error: exError } = await supabase
      .from('workout_exercises')
      .insert(exercisesToInsert)
      .select();

    if (exError) throw exError;

    // Create mapping of exercise name to inserted workout_exercise ID
    // Match based on order_index to be absolutely safe
    const workoutExMap = new Map<string, string>();
    insertedExercises.forEach((ie) => {
      const exerciseObj = w.exercises[ie.order_index];
      if (exerciseObj) {
        workoutExMap.set(exerciseObj.name.toLowerCase().trim(), ie.id);
      }
    });

    // 3. Prepare & Batch Insert Sets for all exercises in this workout
    const setsToInsert: any[] = [];
    w.exercises.forEach((ex) => {
      const workoutExerciseId = workoutExMap.get(ex.name.toLowerCase().trim());
      if (!workoutExerciseId) return;

      // Sort sets by setNum to preserve correct set order
      ex.sets.sort((a, b) => a.setNum - b.setNum);

      ex.sets.forEach((set, setIdx) => {
        // Convert weight to metric KG for storage
        const weightInKg = weightUnitPreference === 'lbs' ? set.weight / 2.20462 : set.weight;

        setsToInsert.push({
          workout_exercise_id: workoutExerciseId,
          set_index: setIdx,
          reps: set.reps,
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
      setsCounter += setsToInsert.length;
    }

    result.workoutsImported++;
  }

  result.setsImported = setsCounter;

  // 6. Optional Routine Template Generation from Unique Workout Names
  if (autoCreateRoutines) {
    onProgress('Analyzing and generating Routine templates...', 92);

    // Group workouts by name to find the latest workout session of each name
    const uniqueWorkoutNames = Array.from(new Set(workoutsList.map((w) => w.name.trim())));

    for (const name of uniqueWorkoutNames) {
      // Find all workouts with this name and select the latest one
      const matchingWorkouts = workoutsList.filter((w) => w.name.trim().toLowerCase() === name.toLowerCase());
      if (matchingWorkouts.length === 0) continue;

      const latestWorkout = matchingWorkouts[matchingWorkouts.length - 1];

      // Check if user already has a routine template with this name
      const { data: existingRoutines, error: checkRoutineError } = await supabase
        .from('routines')
        .select('id')
        .eq('user_id', userId)
        .eq('name', name.trim())
        .limit(1);

      if (checkRoutineError) throw checkRoutineError;

      // Skip creating if a routine with this name already exists
      if (existingRoutines && existingRoutines.length > 0) {
        continue;
      }

      // Create a new Routine Template
      const { data: newRoutine, error: insertRoutineError } = await supabase
        .from('routines')
        .insert({
          name: name.trim(),
          description: `Imported template from training CSV.`,
          user_id: userId,
        })
        .select()
        .single();

      if (insertRoutineError) throw insertRoutineError;
      const routineId = newRoutine.id;

      // Insert routine exercises and sets
      for (let i = 0; i < latestWorkout.exercises.length; i++) {
        const ex = latestWorkout.exercises[i];
        const exerciseId = exerciseMap.get(ex.name.toLowerCase().trim());
        if (!exerciseId) continue;

        const { data: routineExData, error: routineExError } = await supabase
          .from('routine_exercises')
          .insert({
            routine_id: routineId,
            exercise_id: exerciseId,
            order_index: i,
            notes: '',
          })
          .select()
          .single();

        if (routineExError) throw routineExError;
        const routineExerciseId = routineExData.id;

        // Insert routine sets
        const routineSetsToInsert = ex.sets.map((set, setIdx) => {
          const weightInKg = weightUnitPreference === 'lbs' ? set.weight / 2.20462 : set.weight;
          return {
            routine_exercise_id: routineExerciseId,
            set_index: setIdx,
            reps: set.reps,
            weight: weightInKg,
            notes: set.notes || '',
          };
        });

        if (routineSetsToInsert.length > 0) {
          const { error: routineSetsError } = await supabase
            .from('routine_sets')
            .insert(routineSetsToInsert);

          if (routineSetsError) throw routineSetsError;
        }
      }

      result.routinesCreated++;
    }
  }

  onProgress('Completed import successfully.', 100);
  return result;
}

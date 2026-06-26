-- FitBuddy Supabase Database Schema
-- Paste this into the SQL Editor in your Supabase Dashboard.

-- 1. Profiles Table (Linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS on Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to profiles" 
ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Allow users to update their own profile" 
ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Trigger to auto-create a profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'username', 'user_' || SUBSTRING(new.id::text FROM 1 FOR 8))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 2. Folders Table (Workout Splits organization)
CREATE TABLE IF NOT EXISTS public.folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own folders" 
ON public.folders FOR ALL USING (auth.uid() = user_id);


-- 3. Exercises Table (Includes System standard exercises and User custom exercises)
CREATE TABLE IF NOT EXISTS public.exercises (
    id TEXT PRIMARY KEY, -- Can be standard text ID (e.g. 'plank') or UUID
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    instructions TEXT[] NOT NULL DEFAULT '{}',
    video_url TEXT,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE -- NULL for standard system exercises
);

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to exercises (system or own)" 
ON public.exercises FOR SELECT USING (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "Users can insert their own custom exercises" 
ON public.exercises FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update/delete their own custom exercises" 
ON public.exercises FOR ALL USING (auth.uid() = user_id);


-- 4. Routines Table (Saved workout plans)
CREATE TABLE IF NOT EXISTS public.routines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_shared BOOLEAN DEFAULT false NOT NULL,
    likes_count INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to shared routines" 
ON public.routines FOR SELECT USING (is_shared = true OR auth.uid() = user_id);

CREATE POLICY "Users can manage their own routines" 
ON public.routines FOR ALL USING (auth.uid() = user_id);


-- 5. Routine Exercises Table (Exercises mapped to a routine)
CREATE TABLE IF NOT EXISTS public.routine_exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    routine_id UUID NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
    exercise_id TEXT NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    notes TEXT
);

ALTER TABLE public.routine_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to routine exercises" 
ON public.routine_exercises FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.routines 
        WHERE id = routine_id AND (is_shared = true OR user_id = auth.uid())
    )
);

CREATE POLICY "Users can manage exercises in their own routines" 
ON public.routine_exercises FOR ALL USING (
    EXISTS (SELECT 1 FROM public.routines WHERE id = routine_id AND user_id = auth.uid())
);


-- 6. Routine Sets Table (Default targets for sets in a routine)
CREATE TABLE IF NOT EXISTS public.routine_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    routine_exercise_id UUID NOT NULL REFERENCES public.routine_exercises(id) ON DELETE CASCADE,
    set_index INTEGER NOT NULL,
    reps INTEGER,
    weight NUMERIC(6,2),
    notes TEXT
);

ALTER TABLE public.routine_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to routine sets" 
ON public.routine_sets FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.routine_exercises re
        JOIN public.routines r ON re.routine_id = r.id
        WHERE re.id = routine_exercise_id AND (r.is_shared = true OR r.user_id = auth.uid())
    )
);

CREATE POLICY "Users can manage sets in their own routines" 
ON public.routine_sets FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.routine_exercises re
        JOIN public.routines r ON re.routine_id = r.id
        WHERE re.id = routine_exercise_id AND r.user_id = auth.uid()
    )
);


-- 7. Workouts Table (Logged workouts history)
CREATE TABLE IF NOT EXISTS public.workouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    routine_id UUID REFERENCES public.routines(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT
);

ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own workouts" 
ON public.workouts FOR ALL USING (auth.uid() = user_id);


-- 8. Workout Exercises Table (Exercises performed during a logged workout)
CREATE TABLE IF NOT EXISTS public.workout_exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_id UUID NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
    exercise_id TEXT NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    notes TEXT
);

ALTER TABLE public.workout_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own workout exercises" 
ON public.workout_exercises FOR ALL USING (
    EXISTS (SELECT 1 FROM public.workouts WHERE id = workout_id AND user_id = auth.uid())
);


-- 9. Workout Sets Table (Logged sets of an exercise during a workout)
CREATE TABLE IF NOT EXISTS public.workout_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_exercise_id UUID NOT NULL REFERENCES public.workout_exercises(id) ON DELETE CASCADE,
    set_index INTEGER NOT NULL,
    reps INTEGER NOT NULL,
    weight NUMERIC(6,2) NOT NULL,
    is_completed BOOLEAN DEFAULT true NOT NULL,
    notes TEXT
);

ALTER TABLE public.workout_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own workout sets" 
ON public.workout_sets FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.workout_exercises we
        JOIN public.workouts w ON we.workout_id = w.id
        WHERE we.id = workout_exercise_id AND w.user_id = auth.uid()
    )
);


-- 10. Likes Table (Routines upvotes)
CREATE TABLE IF NOT EXISTS public.likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    routine_id UUID NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(user_id, routine_id)
);

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to likes" 
ON public.likes FOR SELECT USING (true);

CREATE POLICY "Users can manage their own likes" 
ON public.likes FOR ALL USING (auth.uid() = user_id);


-- 11. Trigger/Function to automatically sync likes_count on routines
CREATE OR REPLACE FUNCTION public.handle_routine_like()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.routines
        SET likes_count = likes_count + 1
        WHERE id = new.routine_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.routines
        SET likes_count = GREATEST(0, likes_count - 1)
        WHERE id = old.routine_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_routine_liked
    AFTER INSERT OR DELETE ON public.likes
    FOR EACH ROW EXECUTE FUNCTION public.handle_routine_like();

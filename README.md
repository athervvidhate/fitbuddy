# FitBuddy

FitBuddy is a mobile workout tracker and planner built with **Expo (React Native)** and **Supabase**. 

---

## Features

* **Persistent Workout Logger**: Start a workout and navigate anywhere in the app. The active session minimizes to a floating bottom bar with built-in rest timers and exercise notes.
* **Routine Builder**: Create training templates, reorder exercises on the fly, and save default notes.
* **CSV Importer**: Import your historical training logs and routines from Bolt, Hevy, or Strong exports. Includes automatic weight conversion (LBS to KG) and routine generation.
* **Custom Exercises**: Create custom movements that are automatically categorized into muscle groups using a keyword-matching scanner.
* **Telemetry & Preferences**: Toggle dark mode, prevent screen sleep during sessions, and customize measurement scales (KG/LBS, KM/MI, CM/IN).

---

## Tech Stack

* **Frontend**: Expo SDK 56, React Native, Expo Router, Tailwind CSS (NativeWind)
* **Backend**: Supabase (PostgreSQL, Auth, Row Level Security)
* **Animations**: React Native Reanimated
* **Icons**: Lucide React Native

---

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Add environment variables**:
   Create a `.env` file in the root directory:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

3. **Database schema**:
   Execute the SQL files in `src/data/supabase_schema.sql` and `src/data/supabase_seed.sql` inside your Supabase project's SQL editor to set up the tables and preload exercises.

4. **Run the app**:
   ```bash
   npm run start
   ```

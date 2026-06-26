# FitBuddy 🏋️‍♂️

FitBuddy is a high-performance, universal mobile training tracker built with **Expo (React Native)** and **Supabase**. It provides a premium, responsive interface for logging workouts, designing custom training routines, tracking history, and importing data from other platforms.

---

## 🌟 Core Features

### 1. Global Persistent Workout Logger
- **Tab-Agnostic Persistence**: Start a workout and navigate anywhere in the app (Home, Routines, Feed, Analytics, Settings) while your session persists.
- **Minimized Bottom Bar**: Minimize the active session into a floating volcanic orange dashboard bar that sits cleanly above the bottom navigation bar.
- **Dynamic Rest Timer**: A premium, customizable rest timer overlay that triggers upon set completion, supporting quick increments (+30s) and manual dismissal.
- **Exercise-Level Notes**: Add specific execution cues, tempos, or comments per exercise in active sessions.

### 2. Routine Builder & Custom Templates
- **Routine Templates**: Design and save multi-exercise routine structures to quickly trigger future workouts.
- **In-App Exercise Reordering**: Responsive, layout-safe Up / Down controls to easily swap the chronological order of exercises in active sessions or routine builders.
- **Exercise Notes Persistence**: Set default instructions and notes inside routine templates that automatically preload when starting a workout.

### 3. Custom Exercise Creation
- **On-the-Fly Creation**: Create custom exercises directly from selection lists.
- **Guessed Muscle Grouping**: An intelligent keyword scanner automatically categorizes custom exercises (e.g. mapping "Dumbbell Bench Press" to *Chest* or "Leg Press" to *Legs*).
- **Preset Custom Telemetry**: Select equipment types (Barbell, Dumbbell, Machine, Cable, Kettlebell, Band, Bodyweight, etc.) and tracking formats.

### 4. Premium CSV Training Importer
- **Universal Import Support**: Import entire historical logs from platforms like Bolt, Hevy, or Strong.
- **State-Machine CSV Parser**: An O(N) inline parser that handles quoted strings, escaped characters, and carriage returns safely.
- **Target Weight Scaling**: Select the source weight unit (LBS vs. KG) in the importer interface. Weights in pounds are automatically converted to kilograms when synced with the database.
- **Auto-Routine Generator**: Scans your imported CSV history and automatically constructs routine templates based on the latest logged session of each unique workout name.
- **Detailed Progress Tracker**: Shows live progress percentages and import counts, concluding with a detailed statistics summary card.

### 5. Display & Telemetry Scaling Preferences
- **Adaptive Dark Mode**: A premium, high-contrast dark theme with volcanic orange highlights and glowing glassmorphism accents.
- **Telemetry Scaling**: Configure default measurement preferences for Weight (kg / lbs), Distance (km / mi), and Body Measures (cm / in).
- **Display Lock**: Toggle to prevent screen sleep, keeping the screen alive during intensive workout sessions.

---

## 🛠️ Technology Stack

- **Core Framework**: [Expo SDK 56](https://expo.dev) (React Native 0.85)
- **Routing**: Expo Router (file-based navigation)
- **Database & Auth**: [Supabase](https://supabase.com) (PostgreSQL, Real-time Sync, RLS Policies)
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **Animations**: React Native Reanimated (fluid physics-based spring animations)
- **Icons**: Lucide React Native
- **Storage**: AsyncStorage (local draft caching)

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- A Supabase project

### 1. Installation
Clone the repository and install the project dependencies:
```bash
npm install
```

### 2. Database Schema Setup
Execute the SQL DDL statements located in [src/data/supabase_schema.sql](file:///Users/atherv/Projects/fitbuddy/src/data/supabase_schema.sql) in your Supabase project's SQL Editor to set up the tables:
- `profiles`
- `exercises`
- `workouts`
- `workout_exercises`
- `workout_sets`
- `routines`
- `routine_exercises`
- `routine_sets`

To populate the `exercises` table with the preloaded standard movements database, run the SQL seed file located in [src/data/supabase_seed.sql](file:///Users/atherv/Projects/fitbuddy/src/data/supabase_seed.sql).

### 3. Environment Configuration
Create a `.env` file in the root directory of the project and add your Supabase credentials:
```env
EXPO_PUBLIC_SUPABASE_URL=your-supabase-project-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 4. Running the App
Start the Metro bundler using Expo CLI:
```bash
# Start the bundler
npm run start

# Run on iOS Simulator (requires macOS & Xcode)
npm run ios

# Run on Android Emulator (requires Android Studio)
npm run android

# Run in Web Browser
npm run web
```

---

## 📂 Project Structure

```
fitbuddy/
├── src/
│   ├── app/                 # Expo Router file-based pages
│   │   ├── (auth)/          # Authentication flow (Login, Signup)
│   │   └── (tabs)/          # Main App Tabs (Home, Routines, Feed, Analytics, Settings)
│   ├── components/          # Reusable UI components (ActiveWorkoutLogger, BackgroundGlows)
│   ├── context/             # Global Providers (Auth, Theme, Units, Workout)
│   ├── data/                # Data files (Supabase SQL schemas, seed data, local JSONs)
│   ├── lib/                 # Service integrations (Supabase client)
│   └── utils/               # Helper utilities (CSV parser & database importer)
├── tailwind.config.js       # Tailwind configuration for NativeWind
└── tsconfig.json            # TypeScript configuration
```

---

## 🔒 Security
Row Level Security (RLS) is enabled across all tables in Supabase. Users can only read and write their own workout logs, routine structures, and custom exercises, keeping personal telemetry private and secure.

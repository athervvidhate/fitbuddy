/**
 * Inter font loading.
 *
 * Imported by direct subpath rather than from '@expo-google-fonts/inter'. The package's index.js
 * `require`s all 18 faces (9 weights x roman/italic, 7.9MB), so a root import would bundle every
 * one of them. These four subpaths are the only faces the type scale in tokens.js uses.
 */
import { useFonts } from 'expo-font';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Inter_400Regular = require('@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf');
const Inter_500Medium = require('@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf');
const Inter_600SemiBold = require('@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf');
const Inter_700Bold = require('@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf');

export const interFontMap = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
};

/**
 * Returns true once Inter is ready to render.
 *
 * The app holds its existing loading overlay until this flips rather than rendering in system font
 * and swapping — Inter and SF Pro have different metrics, so a swap would visibly reflow every
 * screen on cold start. Blocking briefly is the better trade.
 */
export function useInterFonts(): boolean {
  const [loaded, error] = useFonts(interFontMap);
  if (error) {
    // Never hold the app hostage to a font. Falling through renders in the system face.
    console.error('Failed to load Inter, falling back to system font', error);
    return true;
  }
  return loaded;
}

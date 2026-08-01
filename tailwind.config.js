const tokens = require('./src/theme/tokens.js');

/**
 * Colors resolve per theme via NativeWind's `dark:` variant, e.g. `bg-surface dark:bg-surface-dark`.
 * Values come from src/theme/tokens.js so this config and the JS-side theme cannot drift apart
 * again — previously this file declared violet as the brand accent while every screen hardcoded
 * orange, and src/constants/theme.ts held a third unused palette.
 */
const semantic = (name) => ({
  DEFAULT: tokens.color.light[name],
  dark: tokens.color.dark[name],
});

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/app/**/*.{js,jsx,ts,tsx}',
    './src/components/**/*.{js,jsx,ts,tsx}',
    './src/app/_layout.tsx',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bg: semantic('bg'),
        surface: semantic('surface'),
        'surface-raised': semantic('surfaceRaised'),
        line: semantic('border'),
        'line-soft': semantic('borderSoft'),
        'text-primary': semantic('textPrimary'),
        'text-secondary': semantic('textSecondary'),
        'text-tertiary': semantic('textTertiary'),
        accent: semantic('accent'),
        'accent-soft': semantic('accentSoft'),
        'on-accent': semantic('onAccent'),
        success: semantic('success'),
        warning: semantic('warning'),
        danger: semantic('danger'),
      },
      fontFamily: {
        sans: [tokens.fontFamily.regular],
        medium: [tokens.fontFamily.medium],
        semibold: [tokens.fontFamily.semibold],
        bold: [tokens.fontFamily.bold],
      },
      fontSize: Object.fromEntries(
        Object.entries(tokens.type).map(([name, t]) => [
          name,
          [
            `${t.fontSize}px`,
            { lineHeight: `${t.lineHeight}px`, letterSpacing: `${t.letterSpacing}px` },
          ],
        ])
      ),
      spacing: Object.fromEntries(
        Object.entries(tokens.spacing).map(([name, v]) => [name, `${v}px`])
      ),
      borderRadius: Object.fromEntries(
        Object.entries(tokens.radius).map(([name, v]) => [name, `${v}px`])
      ),
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/app/**/*.{js,jsx,ts,tsx}",
    "./src/components/**/*.{js,jsx,ts,tsx}",
    "./src/app/_layout.tsx"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#050505',     // OLED Vantablack
          card: '#0d0d11',     // Concentric Inner Core
          border: '#1f1f23',   // Soft highlight borders
          accent: '#8b5cf6',   // Neon Violet
          success: '#10b981',  // Emerald Green
          warning: '#f59e0b',  // Amber
          text: '#f4f4f5',     // Light grey for dark mode
          muted: '#8e8e93',    // Sleek muted grey
        }
      }
    },
  },
  plugins: [],
}

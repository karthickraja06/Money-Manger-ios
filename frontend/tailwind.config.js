/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dark Neumorphism Palette
        'dark': {
          'bg': '#121212',        // Deep Matte Black
          'bg-alt': '#1A1A1A',    // Very Dark Grey
          'card': '#242424',      // Card Grey
          'card-hover': '#2D2D2D', // Card Hover
          'border': '#3F3F3F',    // Border
          'text-primary': '#FFFFFF',
          'text-secondary': '#B3B3B3',
          'text-muted': '#808080',
        },
        // Accent Colors
        'accent': {
          'lime': '#CCFF00',      // Electric Lime / Neon Green
          'lime-dark': '#A8D700',  // Darker lime for hover
          'red': '#FF4757',       // For debits/expenses
          'green': '#2ED573',     // For credits/income
          'yellow': '#FFA502',    // For alerts/warnings
          'blue': '#1E90FF',      // For highlights
        }
      },
      fontFamily: {
        'sans': ['Inter', 'Circular', 'Roboto', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'card': '16px',
        'button': '12px',
        'input': '12px',
      },
      spacing: {
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-top': 'env(safe-area-inset-top)',
      },
      backdropBlur: {
        'xs': '2px',
      }
    },
  },
  plugins: [],
};


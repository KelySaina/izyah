import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // IZY'AH gold — sampled from the logo.
        brand: {
          50: '#FFFBEA',
          100: '#FFF3C4',
          200: '#FCE588',
          300: '#FADB5F',
          400: '#FFD23F',
          500: '#F7C331', // primary accent (logo gold)
          600: '#E0A81C', // pressed / deeper
          700: '#B7850F',
          800: '#8A620A',
          900: '#5C4106',
        },
        // Warm neutral near-black for a nightlife / sticker feel.
        ink: {
          950: '#0A0A0B',
          900: '#101012',
          800: '#17171A',
          700: '#202024',
          600: '#2C2C32',
          500: '#3A3A42',
        },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Fredoka Variable"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.3), 0 8px 24px rgba(0,0,0,0.25)',
        glow: '0 6px 22px rgba(247,195,49,0.35)',
      },
      keyframes: {
        'pop-in': {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        'pop-in': 'pop-in 0.18s ease-out',
      },
    },
  },
  plugins: [],
} satisfies Config;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cave: {
          950: '#14130F',   // deepest background
          900: '#1C1A15',   // main background
          800: '#26231C',   // card/surface
          700: '#353126',   // border/divider
        },
        bone: {
          100: '#F5EFE3',   // main text on dark
          300: '#D8CEB8',   // secondary text
        },
        ember: {
          400: '#F0A94E',   // primary accent (glow)
          500: '#E8923A',
          600: '#C97324',
        },
        moss: {
          400: '#8A9A6E',   // secondary accent
          500: '#6F8055',
        },
      },
      fontFamily: {
        mono: ['"Space Mono"', 'ui-monospace', 'monospace'],
        display: ['"Fredoka"', 'ui-rounded', 'sans-serif'],
      },
      borderRadius: {
        cave: '18px',
      },
    },
  },
  plugins: [],
}

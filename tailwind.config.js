/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        'inter': ['Inter', 'sans-serif'],
      },
      colors: {
        green: {
          700: '#2E7D32',
          800: '#1B5E20',
        }
      }
    },
  },
  plugins: [],
};
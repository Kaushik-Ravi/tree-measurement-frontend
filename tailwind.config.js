/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        'inter': ['Inter', 'sans-serif'],
      },
      // --- START: SURGICAL REPLACEMENT ---
      // Replacing the limited, default green colors with a more comprehensive and professional brand palette.
      // This establishes a design system for consistent UI enhancements.
      colors: {
        'brand': {
          green: '#2E7D32',       // A deep, trustworthy green for primary actions.
          'green-dark': '#1B5E20',  // For hover states.
          indigo: '#4F46E5',      // A vibrant secondary color for community features.
          'indigo-dark': '#4338CA',
          amber: '#F59E0B',       // For accents and warnings.
          'amber-dark': '#D97706',
        },
        'base': {
          100: '#F8FAFC', // slate-50
          200: '#F1F5F9', // slate-100
          300: '#E2E8F0', // slate-200
          400: '#CBD5E1', // slate-300
        },
      },
      // --- END: SURGICAL REPLACEMENT ---
    },
  },
  plugins: [],
};
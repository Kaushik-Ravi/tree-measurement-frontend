/** @type {import('tailwindcss').Config} */
export default {
  // --- START: SURGICAL ADDITION ---
  // Enabling class-based dark mode to respect user's system preference via a script.
  darkMode: 'class',
  // --- END: SURGICAL ADDITION ---
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        'inter': ['Inter', 'sans-serif'],
      },
      // --- START: SURGICAL REPLACEMENT ---
      // Replacing the entire color palette with a new, professional, theme-aware system
      // built on CSS variables for seamless light/dark mode switching.
      colors: {
        // Brand colors for primary actions and accents.
        brand: {
          primary: 'rgb(var(--brand-primary) / <alpha-value>)',
          'primary-hover': 'rgb(var(--brand-primary-hover) / <alpha-value>)',
          secondary: 'rgb(var(--brand-secondary) / <alpha-value>)',
          'secondary-hover': 'rgb(var(--brand-secondary-hover) / <alpha-value>)',
          accent: 'rgb(var(--brand-accent) / <alpha-value>)',
          'accent-hover': 'rgb(var(--brand-accent-hover) / <alpha-value>)',
        },
        // Background colors for UI surfaces.
        background: {
          default: 'rgb(var(--bg-default) / <alpha-value>)',
          subtle: 'rgb(var(--bg-subtle) / <alpha-value>)',
          inset: 'rgb(var(--bg-inset) / <alpha-value>)',
        },
        // Content (Text) colors for typography.
        content: {
          default: 'rgb(var(--content-default) / <alpha-value>)',
          subtle: 'rgb(var(--content-subtle) / <alpha-value>)',
          'on-brand': 'rgb(var(--content-on-brand) / <alpha-value>)',
        },
        // Border colors for dividers and outlines.
        stroke: {
          default: 'rgb(var(--stroke-default) / <alpha-value>)',
          subtle: 'rgb(var(--stroke-subtle) / <alpha-value>)',
        },
        // Status colors
        status: {
          success: 'rgb(var(--status-success) / <alpha-value>)',
          warning: 'rgb(var(--status-warning) / <alpha-value>)',
          error: 'rgb(var(--status-error) / <alpha-value>)',
          info: 'rgb(var(--status-info) / <alpha-value>)',
        }
      },
      // --- END: SURGICAL REPLACEMENT ---
    },
  },
  plugins: [],
};
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary palette
        primary: '#7C81FF',
        accent: '#FF9B24',
        secondary: '#00BBAE',

        // Backgrounds
        'bg-cream': '#FFF8EB',
        'bg-white': '#FFFFFF',

        // Text hierarchy
        'text-dark': '#1B1B1B',
        'text-body': '#424242',
        'text-muted': '#9E9E9E',

        // Light backgrounds
        'mint-light': '#EBFFFE',
        'peach-light': '#FFF0E0',
        'lavender-light': '#EDEEFF',
        'rose-light': '#FFF0F0',
        'sunshine-light': '#FFF6EB',

        // Semantic colors
        success: '#4CAF82',
        error: '#FF7C7C',
        warning: '#FFB74D',

        // Additional accent colors
        pink: '#FF577B',
        'sky-blue': '#00B9F1',
        orange: '#FFA455',

        divider: '#F0EDE8',
      },
      fontFamily: {
        baloo: ['Baloo 2', 'sans-serif'],
      },
      fontSize: {
        xs: '13px',
        sm: '15px',
        md: '17px',
        body: '20px',
        lg: '25px',
        xl: '32px',
        xxl: '42px',
        hero: '56px',
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        xxl: '48px',
        xxxl: '64px',
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        xxl: '32px',
        full: '999px',
      },
      boxShadow: {
        sm: '0 2px 8px rgba(124, 129, 255, 0.05)',
        md: '0 4px 16px rgba(124, 129, 255, 0.08)',
        lg: '0 8px 24px rgba(124, 129, 255, 0.12)',
        glow: '0 0 20px rgba(124, 129, 255, 0.2)',
      },
    },
  },
  plugins: [],
} satisfies Config;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Molten Terminal Theme - Dark "Lava" Mode
        dark: {
          bg: '#050309', // Near-black with hint of red
          'bg-deep': '#090605', // Darker panels
          'bg-deeper': '#120807', // Deepest panels
          card: '#090605',
          'card-alt': '#120807',
        },
        // Bright orange-red palette
        molten: {
          DEFAULT: '#FF5722', // Bright orange-red (primary)
          soft: '#FF7043', // Softer orange-red
          ember: '#BF360C', // Darker orange-red
          spark: '#FFB74D', // Bright orange-yellow (sparks)
        },
        // Text colors
        text: {
          primary: '#F9FAFB',
          secondary: '#9CA3AF',
          muted: '#6B7280',
        },
        // Border colors
        border: {
          DEFAULT: 'rgba(148, 163, 184, 0.35)',
          accent: 'rgba(255, 87, 34, 0.6)', // Bright orange-red
          hover: 'rgba(255, 87, 34, 0.8)',
        },
        // Light "Terminal" Mode (Pals + Robinhood)
        terminal: {
          cream: '#F3E7D8',
          paper: '#EEE0CF',
          ink: '#151515',
          line: '#C1A98A',
          green: '#0F4C2E', // Deep green accent (sparingly)
        },
        // Legacy colors (keeping for backward compatibility)
        accent: {
          DEFAULT: '#FF5722', // Bright orange-red
          dark: '#BF360C',
          light: '#FF7043',
          lava: '#FF7043',
          purple: '#BF360C',
          heat: '#FFB74D',
        },
        lumon: {
          900: '#0A0A0A',
          800: '#1A1A1A',
          700: '#2A2A2A',
          600: '#3A3A3A',
          500: '#4A4A4A',
          400: '#6A6A6A',
          300: '#8A8A8A',
          200: '#AAAAAA',
          100: '#CACACA',
          50: '#EAEAEA',
        },
        corporate: {
          blue: '#4A90E2',
          green: '#7ED321',
          orange: '#F5A623',
          red: '#D0021B',
          purple: '#9013FE',
        },
        glass: {
          highlight: '#F8F9FA',
        },
        success: '#7ED321',
        warning: '#F5A623',
        danger: '#D0021B',
      },
      fontFamily: {
        display: ['Monument Extended', 'Arial Black', 'sans-serif'], // Brutalist display font
        body: ['Space Grotesk', 'Inter', 'Helvetica', 'Arial', 'sans-serif'], // Premium grotesk
        mono: ['JetBrains Mono', 'Fira Code', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
        corporate: ['Space Grotesk', 'Inter', 'Arial', 'Helvetica', 'sans-serif'],
      },
      letterSpacing: {
        tight: '-0.025em',
      },
      backdropBlur: {
        xl: '24px',
      },
      boxShadow: {
        glass: '0 20px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
        'glass-inset': 'inset 0 1px 0 rgba(255,255,255,0.06)',
      },
      animation: {
        'pixel-sparkle': 'pixel-sparkle 0.3s ease-out',
        'ttl-tick': 'ttl-tick 1s linear infinite',
        glow: 'glow 2s ease-in-out infinite alternate',
        'ember-pulse': 'ember-pulse 3s ease-in-out infinite',
        'heat-ripple': 'heat-ripple 4s ease-in-out infinite',
        'molten-shimmer': 'molten-shimmer 2.5s ease-in-out infinite',
        'pk-gradient': 'pk-gradient-shift 22s ease-in-out infinite alternate',
        'pk-grain': 'pk-grain-flicker 2.8s steps(2) infinite',
      },
      keyframes: {
        'pixel-sparkle': {
          '0%': { opacity: '0', transform: 'scale(0.5) translateY(0)' },
          '50%': { opacity: '1', transform: 'scale(1) translateY(-10px)' },
          '100%': { opacity: '0', transform: 'scale(0.5) translateY(-20px)' },
        },
        'ttl-tick': {
          '0%': { opacity: '1' },
          '50%': { opacity: '0.7' },
          '100%': { opacity: '1' },
        },
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(255, 106, 0, 0.2)' },
          '100%': { boxShadow: '0 0 40px rgba(255, 106, 0, 0.4)' },
        },
        'ember-pulse': {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
        },
        'heat-ripple': {
          '0%': { transform: 'scale(1)', opacity: '0.8' },
          '50%': { transform: 'scale(1.1)', opacity: '0.4' },
          '100%': { transform: 'scale(1)', opacity: '0.8' },
        },
        'molten-shimmer': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        'pk-gradient-shift': {
          '0%': { backgroundPosition: '0% 0%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 100%' },
        },
        'pk-grain-flicker': {
          '0%': { opacity: '0.10' },
          '50%': { opacity: '0.16' },
          '100%': { opacity: '0.10' },
        },
      },
    },
  },
  plugins: [],
}

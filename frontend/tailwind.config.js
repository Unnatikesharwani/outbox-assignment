/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'] },
      colors: {
        ink: { 900: '#14201f', 700: '#364846', 500: '#6b7c7a', 300: '#c9d3d1', 100: '#eef2f1', 50: '#f7f9f8' },
        brand: { 600: '#0f766e', 700: '#0b5f58', 100: '#d5efec', 50: '#ecf8f6' },
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 950: '#050d1f', 900: '#07152f', 800: '#0d2246', 700: '#153564' },
        brand: { 50: '#eff7ff', 100: '#dbeeff', 500: '#1785ff', 600: '#0969e8', 700: '#0755bd' },
      },
      boxShadow: {
        card: '0 12px 36px rgba(7, 21, 47, 0.08)',
        glow: '0 18px 55px rgba(23, 133, 255, 0.22)',
      },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      animation: { 'fade-up': 'fadeUp .55s ease-out both' },
      keyframes: { fadeUp: { from: { opacity: '0', transform: 'translateY(14px)' }, to: { opacity: '1', transform: 'translateY(0)' } } },
    },
  },
  plugins: [],
};

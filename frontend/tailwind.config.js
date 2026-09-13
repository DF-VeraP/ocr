/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        sena: {
          50: '#f2f9f4',
          100: '#e1f3e7',
          500: '#39a900', // Verde institucional SENA
          600: '#2e8600',
          700: '#236500',
          800: '#1b4d00',
          900: '#00324d', // Azul SENA
        }
      }
    },
  },
  plugins: [],
}

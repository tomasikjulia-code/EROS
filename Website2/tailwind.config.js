/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'slide-in-right': 'slideInRight 0.5s cubic-bezier(0.25, 1, 0.5, 1)',
        'slide-in-left':  'slideInLeft  0.5s cubic-bezier(0.25, 1, 0.5, 1)',
      },
      keyframes: {
        slideInRight: {
          '0%':   { transform: 'translateX(60px)', opacity: '0', filter: 'blur(6px)' },
          '100%': { transform: 'translateX(0)',    opacity: '1', filter: 'blur(0px)' },
        },
        slideInLeft: {
          '0%':   { transform: 'translateX(-60px)', opacity: '0', filter: 'blur(6px)' },
          '100%': { transform: 'translateX(0)',      opacity: '1', filter: 'blur(0px)' },
        },
      },
    },
  },
  plugins: [],
}

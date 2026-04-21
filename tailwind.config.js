/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        saffron: {
          50: "#FFF8EC",
          100: "#FFEED0",
          200: "#FFDA9A",
          300: "#FFC062",
          400: "#FFA836",
          500: "#FF9933",
          600: "#E8801A",
          700: "#B85F10",
          800: "#8A460D",
          900: "#5C2F08",
        },
        maroon: {
          500: "#A82121",
          600: "#8B1A1A",
          700: "#6E1414",
          800: "#4F0E0E",
        },
        cream: "#FFF8EC",
        ink: "#2C1810",
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', "Georgia", "serif"],
        sans: ['"Inter"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

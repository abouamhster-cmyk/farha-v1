/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FAF5EC",
        paper: "#FFFFFF",
        ink: "#14110F",
        muted: "#5C5449",
        line: "#E5DCCB",
        emerald: { DEFAULT: "#0A3832", light: "#12544B" },
        safran: { DEFAULT: "#E89528", bright: "#FAA831", bg: "#FFF8EB" },
        henne: { DEFAULT: "#B83A28", light: "#D94B37" },
      },
      fontFamily: {
        display: ["Fraunces", "serif"],
        sans: ["Inter", "sans-serif"],
        arabic: ["Amiri", "serif"],
      },
      keyframes: {
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
        scaleIn: { from: { opacity: "0", transform: "scale(0.95)" }, to: { opacity: "1", transform: "scale(1)" } },
      },
      animation: {
        fadeIn: "fadeIn 0.2s ease-out",
        scaleIn: "scaleIn 0.2s ease-out",
      },
    },
  },
  plugins: [],
};

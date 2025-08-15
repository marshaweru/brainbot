/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { pink: "#ff3d67", mint: "#4ade80", sky: "#38bdf8" }
      },
      boxShadow: { soft: "0 10px 25px rgba(0,0,0,0.12)" },
      borderRadius: { "2xl": "1.25rem" }
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: { pink: "#ff3d67", mint: "#4ade80", sky: "#38bdf8" },
        bg: "#0b1220",
      },
      fontFamily: {
        heading: ["var(--font-heading)", "ui-sans-serif", "system-ui"],
        body: ["var(--font-body)", "ui-sans-serif", "system-ui"],
      },
      boxShadow: {
        soft: "0 10px 25px rgba(0,0,0,0.12)",
        xl: "0 10px 25px rgba(0,0,0,0.18)",
        "2xl": "0 20px 40px rgba(0,0,0,0.25)",
      },
      borderRadius: { "2xl": "1.25rem" },
      keyframes: {
        slideDown: { "0%": { opacity: "0", transform: "translateY(-10px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        slideUp:   { "0%": { opacity: "1", transform: "translateY(0)" },      "100%": { opacity: "0", transform: "translateY(-10px)" } },
        founderGlow: {
          "0%,100%": { boxShadow: "0 0 0 rgba(251,191,36,0)" },
          "50%":     { boxShadow: "0 0 24px rgba(251,191,36,0.55)" },
        },
        nudgePulse: {
          "0%":   { transform: "scale(1)",   boxShadow: "0 0 0 rgba(16,185,129,0.0)" },
          "45%":  { transform: "scale(1.04)", boxShadow: "0 0 28px rgba(16,185,129,0.35)" },
          "100%": { transform: "scale(1)",   boxShadow: "0 0 0 rgba(16,185,129,0.0)" },
        },
      },
      animation: {
        slideDown: "slideDown 0.25s ease-out forwards",
        slideUp: "slideUp 0.2s ease-in forwards",
        "pulse-glow": "founderGlow 2.2s ease-in-out infinite",
        "pulse-once": "nudgePulse 0.95s ease-out 1",
      },
    },
  },
  plugins: [],
};

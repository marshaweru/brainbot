import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Existing brand yellow
        brand: {
          100: "#FFF7D6",
          500: "#FFD600",
          700: "#F3C000",
        },
        // Premium dark palette
        ink: {
          900: "#0a101d",
          800: "#121a2b",
          700: "#1a2233",
        },
        plum: {
          500: "#7a3cff",
          400: "#9a68ff",
        },
        mint: {
          500: "#22e3c5",
          400: "#64f1dc",
        },
        gold: {
          500: "#ffd54a",
          400: "#ffe27a",
        },
        steel: {
          300: "#d1d5db",
          200: "#e5e7eb",
        },
      },
      boxShadow: {
        glass: "0 6px 32px 0 rgba(16, 38, 49, 0.17)",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};

export default config;

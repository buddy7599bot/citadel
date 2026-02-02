import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        warm: {
          50: "#FAFAF8",
          100: "#F5F3EF",
          200: "#E8E5E0",
          600: "#6B6B6B",
          900: "#1A1A1A",
        },
        accent: {
          500: "#D97706",
        },
        success: {
          500: "#16A34A",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.06)",
      },
    },
  },
  plugins: [],
};

export default config;

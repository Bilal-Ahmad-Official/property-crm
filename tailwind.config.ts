import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#dce7fe",
          200: "#c0d4fd",
          300: "#94b8fb",
          400: "#6192f7",
          500: "#3d6df2",
          600: "#274de6",
          700: "#1f3ad3",
          800: "#2031ab",
          900: "#1f2f87",
          950: "#171f52",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Manrope", "system-ui", "sans-serif"],
        heading: ["Space Grotesk", "system-ui", "sans-serif"],
      },
      colors: {
        // Same lightness steps as Tailwind's `slate`, hue shifted to a subtle violet tint
        // (~260°) instead of blue-gray (~215°) — a custom neutral that matches the violet
        // accent instead of a stock gray family (zinc/neutral/stone) sitting next to it.
        ink: {
          50: "hsl(260, 50%, 98%)",
          100: "hsl(260, 45%, 96%)",
          200: "hsl(260, 35%, 91%)",
          300: "hsl(260, 25%, 82%)",
          400: "hsl(260, 15%, 66%)",
          500: "hsl(260, 12%, 49%)",
          600: "hsl(260, 14%, 37%)",
          700: "hsl(260, 16%, 26%)",
          800: "hsl(260, 18%, 17%)",
          900: "hsl(260, 20%, 11%)",
          950: "hsl(260, 22%, 6%)",
        },
      },
    },
  },
  plugins: [],
};

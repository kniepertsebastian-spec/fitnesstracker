// Token colors that accept Tailwind opacity modifiers (e.g. `border-danger/40`).
const withAlpha = (name) => `color-mix(in srgb, var(--${name}) calc(<alpha-value> * 100%), transparent)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Geist Variable", "system-ui", "sans-serif"],
        heading: ["Geist Variable", "system-ui", "sans-serif"],
        mono: ["Geist Mono Variable", "ui-monospace", "monospace"],
      },
      // Token names follow docs/ROADMAP-UI.md ("Designsprache"); values live as CSS variables in
      // src/styles/index.css so a light theme can be added later without touching components.
      borderColor: { DEFAULT: "var(--border)" },
      colors: {
        bg: { DEFAULT: "var(--bg)", sidebar: "var(--bg-sidebar)" },
        surface: {
          DEFAULT: "var(--surface)",
          2: "var(--surface-2)",
          inset: "var(--surface-inset)",
        },
        control: "var(--control)",
        track: "var(--track)",
        border: {
          DEFAULT: "var(--border)",
          strong: "var(--border-strong)",
          subtle: "var(--border-subtle)",
          accent: "var(--accent-border)",
          hero: "var(--hero-border)",
        },
        text: {
          DEFAULT: "var(--text)",
          2: "var(--text-2)",
          muted: "var(--text-muted)",
          subtle: "var(--text-subtle)",
          faint: "var(--text-faint)",
        },
        accent: {
          DEFAULT: withAlpha("accent"),
          hover: "var(--accent-hover)",
          soft: "var(--accent-soft)",
          border: "var(--accent-border)",
        },
        "on-accent": "var(--on-accent)",
        info: { DEFAULT: withAlpha("info"), text: "var(--info-text)", soft: "var(--info-soft)" },
        warning: { DEFAULT: withAlpha("warning"), soft: "var(--warning-soft)" },
        danger: {
          DEFAULT: withAlpha("danger"),
          text: "var(--danger-text)",
          soft: "var(--danger-soft)",
        },
        violet: { DEFAULT: "var(--violet)", soft: "var(--violet-soft)" },
        // Legacy palette — remains only until F8 migrates the remaining pages, then it is removed.
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
      borderRadius: {
        sm: "9px",
        md: "10px",
        lg: "12px",
        xl: "14px",
        "2xl": "16px",
        "3xl": "18px",
      },
      fontSize: {
        overline: ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.07em", fontWeight: "600" }],
        small: ["0.8125rem", { lineHeight: "1.25rem" }],
        body: ["0.9375rem", { lineHeight: "1.5rem" }],
        h2: ["1.0625rem", { lineHeight: "1.5rem", fontWeight: "600" }],
        "h2-hero": ["1.5rem", { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "600" }],
        h1: ["1.75rem", { lineHeight: "1.15", letterSpacing: "-0.025em", fontWeight: "600" }],
        "h1-lg": ["2.125rem", { lineHeight: "1.15", letterSpacing: "-0.025em", fontWeight: "600" }],
        "h1-focus": ["1.5rem", { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "600" }],
        stat: ["1.75rem", { lineHeight: "1.15", letterSpacing: "-0.02em", fontWeight: "600" }],
        timer: ["2.5rem", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "500" }],
      },
      boxShadow: {
        overlay: "-24px 0 48px rgba(0, 0, 0, 0.35)",
      },
      backgroundImage: {
        hero: "linear-gradient(135deg, #12201B 0%, #12161E 55%)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-in-right": { from: { transform: "translateX(100%)" }, to: { transform: "none" } },
        "pop-in": {
          from: { opacity: "0", transform: "translateY(-8px)" },
          to: { opacity: "1", transform: "none" },
        },
        pulse: { "50%": { opacity: "0.5" } },
      },
      animation: {
        "fade-in": "fade-in 200ms ease-out",
        "slide-in-right": "slide-in-right 250ms ease-out",
        "pop-in": "pop-in 200ms ease-out",
      },
    },
  },
  plugins: [],
};

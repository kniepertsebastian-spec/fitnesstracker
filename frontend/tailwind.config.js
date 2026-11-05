// Token colors that accept Tailwind opacity modifiers (e.g. `border-danger/40`).
const withAlpha = (name) => `color-mix(in srgb, var(--${name}) calc(<alpha-value> * 100%), transparent)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Geist Variable", "system-ui", "sans-serif"],
        heading: ["Archivo Variable", "Geist Variable", "system-ui", "sans-serif"],
        // Weight, reps, timers, stats: narrowed Archivo with tabular figures (see index.css).
        numeric: ["Archivo Variable", "Geist Variable", "system-ui", "sans-serif"],
        mono: ["Geist Mono Variable", "ui-monospace", "monospace"],
      },
      // Token names follow docs/ROADMAP-UI.md ("Designsprache"); values live as CSS variables in
      // src/styles/index.css so a light theme can be added later without touching components.
      borderColor: { DEFAULT: "var(--border)" },
      // Violet text uses the lighter tint so it stays readable at small sizes; fills keep --accent.
      textColor: { accent: { DEFAULT: "var(--accent-text)", hover: "var(--accent-text-hover)" } },
      colors: {
        bg: { DEFAULT: withAlpha("bg"), sidebar: withAlpha("bg-sidebar") },
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
        success: { DEFAULT: withAlpha("success"), soft: "var(--success-soft)" },
        info: { DEFAULT: withAlpha("info"), text: "var(--info-text)", soft: "var(--info-soft)" },
        warning: { DEFAULT: withAlpha("warning"), soft: "var(--warning-soft)" },
        danger: {
          DEFAULT: withAlpha("danger"),
          text: "var(--danger-text)",
          soft: "var(--danger-soft)",
        },
        magenta: { DEFAULT: "var(--magenta)", soft: "var(--magenta-soft)" },
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
        overline: ["0.75rem", { lineHeight: "1rem", letterSpacing: "0.01em", fontWeight: "600" }],
        small: ["0.8125rem", { lineHeight: "1.25rem" }],
        body: ["0.9375rem", { lineHeight: "1.5rem" }],
        h2: ["1.0625rem", { lineHeight: "1.5rem", fontWeight: "600" }],
        "h2-hero": ["1.75rem", { lineHeight: "1.1", letterSpacing: "-0.01em", fontWeight: "700" }],
        h1: ["2rem", { lineHeight: "1.05", letterSpacing: "-0.015em", fontWeight: "800" }],
        "h1-lg": ["2.5rem", { lineHeight: "1.05", letterSpacing: "-0.015em", fontWeight: "800" }],
        "h1-focus": ["1.625rem", { lineHeight: "1.1", letterSpacing: "-0.01em", fontWeight: "700" }],
        stat: ["1.875rem", { lineHeight: "1.05", letterSpacing: "-0.01em", fontWeight: "700" }],
        "set-value": ["1.375rem", { lineHeight: "1.1", fontWeight: "600" }],
        timer: ["3.5rem", { lineHeight: "1", letterSpacing: "-0.01em", fontWeight: "700" }],
      },
      boxShadow: {
        overlay: "-24px 0 48px rgba(0, 0, 0, 0.35)",
      },
      backgroundImage: {
        hero: "linear-gradient(135deg, #24164A 0%, #161C38 45%, #111A2E 75%)",
        "accent-fill": "linear-gradient(180deg, #9466F7 0%, #8B5CF6 55%, #7C4DEB 100%)",
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

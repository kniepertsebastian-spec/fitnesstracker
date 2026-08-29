// Flat config (ESLint 10) at the workspace root — each package's own `eslint .` finds this by
// walking up from its own directory, so no per-package config duplication is needed.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/.vite/**",
      "**/test-results/**",
      "**/playwright-report/**",
      "backend/prisma/migrations/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // Backend + shared: plain Node/TS, no React.
  {
    files: ["backend/**/*.ts", "packages/shared/**/*.ts"],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      // Deliberate in this codebase: fire-and-forget mutations (push notifications, offline
      // queue flushes) are intentionally not awaited by their caller — see e.g.
      // workoutLog.routes.ts's `void checkAndNotifyPersonalRecord(...)`.
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
  // Frontend: React + browser globals + hooks rules.
  {
    files: ["frontend/src/**/*.{ts,tsx}"],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      // Only the two classic, load-bearing hooks rules — `recommended` in this plugin version
      // also bundles the newer React Compiler diagnostics (set-state-in-effect,
      // incompatible-library, ...), which flag the derived-state-from-props effect pattern used
      // deliberately throughout this codebase (e.g. AppShell, TrainingPlanPage,
      // WorkoutHistoryPage defaulting a selection once a query resolves). That's a working,
      // common React pattern, not a bug worth a wide unrelated rewrite just to satisfy lint.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
  // Service worker script (public/push-sw.js) — plain JS loaded via importScripts, its own
  // global scope (`self`, not `window`).
  {
    files: ["frontend/public/**/*.js"],
    languageOptions: {
      globals: globals.serviceworker,
    },
  },
  // E2E tests: Node + Playwright globals, not part of the shipped app.
  {
    files: ["frontend/e2e/**/*.ts", "frontend/playwright.config.ts"],
    languageOptions: {
      globals: globals.node,
    },
  },
  // Config files themselves (vite.config.ts, etc.) run under Node, not the browser.
  {
    files: ["**/*.config.{js,ts}"],
    languageOptions: {
      globals: globals.node,
    },
  },
);

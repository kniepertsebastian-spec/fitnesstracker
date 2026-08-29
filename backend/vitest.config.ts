import { defineConfig } from "vitest/config";

// These unit tests only exercise pure functions (see e.g. goalSuggestion.service.test.ts,
// dailyChallenge.service.test.ts) — no database, no real secrets needed. But importing those
// modules still pulls in config/env.ts, which parses process.env at import time and throws if
// its required vars are missing (fail-fast on boot, see that file's own comment). These dummy
// values exist only to satisfy that parse in the test environment, never to be used for anything
// real; a genuine `.env` (local dev) or CI secrets take priority whenever they're actually set.
export default defineConfig({
  test: {
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://test:test@localhost:5432/test",
      JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? "test-access-secret-not-real",
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? "test-refresh-secret-not-real",
      SETUP_TOKEN: process.env.SETUP_TOKEN ?? "test-setup-token",
    },
  },
});

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { defineConfig } from "vitest/config";

// Most tests exercise pure functions (see e.g. goalSuggestion.service.test.ts,
// dailyChallenge.service.test.ts) — no database, no real secrets needed. But importing those
// modules still pulls in config/env.ts, which parses process.env at import time and throws if
// its required vars are missing (fail-fast on boot, see that file's own comment). These dummy
// values exist only to satisfy that parse in the test environment, never to be used for anything
// real; a genuine `.env` (local dev) or CI secrets take priority whenever they're actually set.
//
// The integration tests (src/integration/*.integration.test.ts) talk to a real Postgres and only
// run when TEST_DATABASE_URL is set — a separate variable on purpose, so a developer's DATABASE_URL
// (their real data) can never be picked up by a test run by accident. In that mode the app is built
// against that database, with a throwaway uploads folder and a rate limit the suite can't trip.
const integrationDb = process.env.TEST_DATABASE_URL;

export default defineConfig({
  test: {
    // The integration files share one database; running them one after another keeps them simple.
    fileParallelism: !integrationDb,
    env: {
      DATABASE_URL: integrationDb ?? process.env.DATABASE_URL ?? "postgresql://test:test@localhost:5432/test",
      JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? "test-access-secret-not-real",
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? "test-refresh-secret-not-real",
      SETUP_TOKEN: process.env.SETUP_TOKEN ?? "test-setup-token",
      OPERATOR_EMAIL: "operator@fitnesstracker.test",
      RESET_TOKEN: process.env.RESET_TOKEN ?? "test-reset-token-not-real",
      ...(integrationDb
        ? {
            AUTH_RATE_LIMIT_PER_MINUTE: "1000",
            HEAVY_RATE_LIMIT_PER_MINUTE: "1000",
            UPLOADS_DIR: mkdtempSync(path.join(tmpdir(), "fitnesstracker-test-uploads-")),
          }
        : {}),
    },
  },
});

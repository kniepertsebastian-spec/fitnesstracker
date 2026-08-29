import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

// This suite specifically needs a real service worker (an offline "App neu laden" only works
// because Workbox precaches the app shell — `pnpm dev`'s Vite dev server has no service worker
// at all, see the note in ARCHITECTURE.md), so it runs against a production build served by
// `vite preview`, never against `pnpm dev`. Only the frontend is managed here — the backend
// (with Postgres reachable and migrations applied) is assumed already running on :3000, the
// same manual setup used throughout local development; CI (see .github/workflows) brings its
// own Postgres service and starts the backend itself before this suite runs.
export default defineConfig({
  testDir: "./e2e",
  // Serial: tests share one registered test user and read/assert on that account's live sync
  // state (pending/failed counts, table rows) — running them concurrently would race.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    // Unset by default — Playwright then launches whatever `playwright install` put in its own
    // managed browser cache, which is what a normal CI runner (and `pnpm exec playwright
    // install`) sets up. Only set PLAYWRIGHT_CHROMIUM_PATH when a sandboxed/offline environment
    // provides its own pre-installed Chromium at a fixed path instead.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm build && pnpm preview --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

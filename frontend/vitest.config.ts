import { defineConfig } from "vitest/config";

// Unit tests for the pure helpers under src/lib. Deliberately separate from vite.config.ts so the
// PWA/React plugins are not loaded; the browser flows are covered by the Playwright suite in e2e/.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});

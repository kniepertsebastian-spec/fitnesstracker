import { defineConfig } from "vitest/config";

// Only the sources. `tsc` also compiles the *.test.ts files into dist/ (the same tsconfig serves
// typecheck), and since vitest 3 the default `exclude` no longer skips dist/, so without this every
// test would run twice (once from src, once as compiled JS).
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});

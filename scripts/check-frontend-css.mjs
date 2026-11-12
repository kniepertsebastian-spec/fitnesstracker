// Guards the production frontend build against the "unstyled app" failure: Tailwind 4 runs as a
// PostCSS plugin, so when postcss.config.js is missing from the build (e.g. not copied into the
// Docker image) Vite silently ships the raw `@import "tailwindcss"` source and the app renders
// without any styling. (Vite inlines the import, so the broken output carries Tailwind's own
// `@theme`/`@layer theme` source and no utility classes — it is even bigger than 20 kB.) Usage: node scripts/check-frontend-css.mjs [dist-dir]
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const MIN_CSS_BYTES = 20 * 1024;
const dist = path.resolve(process.argv[2] ?? "frontend/dist");
const assets = path.join(dist, "assets");

let files;
try {
  files = readdirSync(assets).filter((name) => name.endsWith(".css"));
} catch {
  console.error(`check-frontend-css: ${assets} not found — build the frontend first.`);
  process.exit(1);
}
if (files.length === 0) {
  console.error(`check-frontend-css: no CSS file in ${assets}.`);
  process.exit(1);
}

let failed = false;
for (const name of files) {
  const content = readFileSync(path.join(assets, name), "utf8");
  if (/@import\s+["']tailwindcss|@theme\b|@tailwind\b|@apply\b/.test(content)) {
    console.error(`check-frontend-css: ${name} still contains raw Tailwind directives (PostCSS did not run).`);
    failed = true;
  }
  if (!/\.flex\s*\{/.test(content) && !/\.hidden\s*\{/.test(content)) {
    console.error(`check-frontend-css: ${name} contains no Tailwind utility classes.`);
    failed = true;
  }
}
const largest = Math.max(...files.map((name) => readFileSync(path.join(assets, name)).length));
if (largest < MIN_CSS_BYTES) {
  console.error(`check-frontend-css: largest CSS file is ${largest} bytes, expected more than ${MIN_CSS_BYTES} (utilities missing).`);
  failed = true;
}
if (failed) process.exit(1);
console.log(`check-frontend-css: ok (${files.length} file(s), largest ${largest} bytes).`);

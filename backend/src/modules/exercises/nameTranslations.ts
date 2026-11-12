import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// English name -> German display name for the free-exercise-db catalog. The file lives in
// prisma/data (shipped in the production image next to dist); src/ and dist/ sit at the same
// depth, so the relative path is the same in development and in production.
const FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../prisma/data/exerciseNameTranslationsDe.json",
);

let cache: Record<string, string> | null = null;

export function loadNameTranslations(): Record<string, string> {
  if (cache) return cache;
  try {
    cache = JSON.parse(readFileSync(FILE, "utf-8")) as Record<string, string>;
  } catch {
    // The import must not fail only because the translation table is missing: names then stay English.
    cache = {};
  }
  return cache;
}

export function germanExerciseName(name: string): string | undefined {
  return loadNameTranslations()[name];
}

/** Test hook. */
export function resetNameTranslationsCache() {
  cache = null;
}

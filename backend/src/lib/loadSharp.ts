import type sharpFactory from "sharp";

// Loaded lazily (only when an image is actually processed) rather than as a static top-level
// import. sharp bundles a precompiled native libvips binary, and that binary's own CPU-feature
// initialization can fail outright on hardware that doesn't support the instructions it assumes
// (e.g. AVX2) — a SIGILL, which crashes the whole Node process and can't be caught by any
// try/catch. A static import pays that risk on every single backend boot, taking the entire app
// down with it; deferred like this, the same failure is contained to just the request that
// triggered it, and every other route keeps working. See CHANGELOG.md for the incident this
// came out of.
let sharpModule: Promise<typeof sharpFactory> | null = null;

export function loadSharp(): Promise<typeof sharpFactory> {
  if (!sharpModule) {
    // Don't cache a rejection: the next attempt retries the import.
    sharpModule = import("sharp").then((mod) => mod.default).catch((error: unknown) => {
      sharpModule = null;
      throw error;
    });
  }
  return sharpModule;
}

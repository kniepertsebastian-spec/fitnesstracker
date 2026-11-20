import type { ExerciseDto } from "@fitnesstracker/shared";

// The exercise pictures on the device. The service worker keeps pictures it has seen in this cache
// (vite.config.ts); the "offline package" fills it ahead of time with every picture of the catalog, so the
// exercises look the same without a connection. The pictures are small WebP files made by the server.

export const IMAGE_CACHE_NAME = "exercise-images-cache";

const absolute = (url: string) => new URL(url, window.location.origin).href;

// Every distinct picture address of the catalog that lives on our own server.
export function packUrls(catalog: ExerciseDto[]): string[] {
  const urls = new Set<string>();
  for (const e of catalog) {
    for (const url of e.imageUrls) {
      if (url.startsWith("/api/exercise-images/")) urls.add(absolute(url));
    }
  }
  return [...urls];
}

async function openCache(): Promise<Cache | null> {
  try {
    return typeof caches === "undefined" ? null : await caches.open(IMAGE_CACHE_NAME);
  } catch {
    return null;
  }
}

export interface PackStatus {
  total: number;
  cached: number;
}

export async function getPackStatus(catalog: ExerciseDto[]): Promise<PackStatus> {
  const urls = packUrls(catalog);
  const cache = await openCache();
  if (!cache) return { total: urls.length, cached: 0 };
  const have = new Set((await cache.keys()).map((r) => r.url));
  return { total: urls.length, cached: urls.filter((u) => have.has(u)).length };
}

export interface PackProgress {
  done: number;
  total: number;
  failed: number;
}

// Downloads what is missing, a few at a time. Stops early when `signal` aborts; a picture that fails (no
// connection, 404) is counted and skipped, a second run picks it up again.
export async function downloadPack(
  catalog: ExerciseDto[],
  onProgress: (progress: PackProgress) => void,
  signal?: AbortSignal,
  concurrency = 4,
): Promise<PackProgress> {
  const cache = await openCache();
  const progress: PackProgress = { done: 0, total: 0, failed: 0 };
  if (!cache) return progress;
  const have = new Set((await cache.keys()).map((r) => r.url));
  const missing = packUrls(catalog).filter((u) => !have.has(u));
  progress.total = missing.length;
  onProgress({ ...progress });

  const queue = [...missing];
  const worker = async () => {
    for (let url = queue.pop(); url; url = queue.pop()) {
      if (signal?.aborted) return;
      try {
        const response = await fetch(url, { signal });
        if (response.ok) await cache.put(url, response);
        else progress.failed += 1;
      } catch {
        if (signal?.aborted) return;
        progress.failed += 1;
      }
      progress.done += 1;
      onProgress({ ...progress });
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return progress;
}

export async function clearPack(): Promise<void> {
  try {
    if (typeof caches !== "undefined") await caches.delete(IMAGE_CACHE_NAME);
  } catch {
    // nothing to clear
  }
}

// Rough size of what the browser stores for this site, to show next to the package.
export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    const e = await navigator.storage?.estimate?.();
    return e && typeof e.usage === "number" && typeof e.quota === "number" ? { usage: e.usage, quota: e.quota } : null;
  } catch {
    return null;
  }
}

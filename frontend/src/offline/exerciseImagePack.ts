import type { ExerciseDto } from "@fitnesstracker/shared";
import { isQuotaExceededError } from "./quotaError";

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
  // The device ran out of storage: the download stopped there, what was saved before stays.
  quotaExceeded: boolean;
}

// Downloads what is missing, a few at a time. Stops early when `signal` aborts; a picture that fails (no
// connection, 404) is counted and skipped, a second run picks it up again. A full device stops the whole
// run at once (`quotaExceeded`): every further picture would fail the same way, and trying on would only
// push the user's own entries (sets, sessions) closer to the limit.
export async function downloadPack(
  catalog: ExerciseDto[],
  onProgress: (progress: PackProgress) => void,
  signal?: AbortSignal,
  concurrency = 4,
): Promise<PackProgress> {
  const cache = await openCache();
  const progress: PackProgress = { done: 0, total: 0, failed: 0, quotaExceeded: false };
  if (!cache) return progress;
  const have = new Set((await cache.keys()).map((r) => r.url));
  const missing = packUrls(catalog).filter((u) => !have.has(u));
  progress.total = missing.length;
  onProgress({ ...progress });

  // Cancels the downloads still in flight, whether the caller aborts or the storage is full.
  const stop = new AbortController();
  const onAbort = () => stop.abort();
  if (signal?.aborted) stop.abort();
  else signal?.addEventListener("abort", onAbort, { once: true });

  const queue = [...missing];
  const worker = async () => {
    for (let url = queue.pop(); url; url = queue.pop()) {
      if (stop.signal.aborted) return;
      try {
        const response = await fetch(url, { signal: stop.signal });
        if (response.ok) await cache.put(url, response);
        else progress.failed += 1;
      } catch (error) {
        if (isQuotaExceededError(error)) {
          if (!progress.quotaExceeded) {
            progress.quotaExceeded = true;
            stop.abort();
            onProgress({ ...progress });
          }
          return;
        }
        if (stop.signal.aborted) return;
        progress.failed += 1;
      }
      progress.done += 1;
      onProgress({ ...progress });
    }
  };
  try {
    await Promise.all(Array.from({ length: concurrency }, worker));
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
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

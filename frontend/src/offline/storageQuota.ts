import { useStorageNoticeStore } from "../stores/storageNoticeStore";
import { offlineDb } from "./db";
import { clearPack } from "./exerciseImagePack";
import { isQuotaExceededError } from "./quotaError";

// A full device (or a browser that hands this site only a small share of it) makes IndexedDB
// writes fail with QuotaExceededError. Losing a logged set to that is the worst case, so writes
// that hold the user's own entries go through writeWithQuotaRecovery: it first frees what can be
// fetched again (the persisted query cache, optionally the exercise pictures) and tries once more.

export const STORAGE_FULL_MESSAGE =
  "Der Speicher auf diesem Gerät ist voll, deshalb konnte der Eintrag nicht gespeichert werden. " +
  "Bitte gib Speicherplatz frei (z. B. nicht mehr benötigte Apps, Fotos oder Downloads) und versuche es erneut.";

export class StorageQuotaError extends Error {
  constructor(cause?: unknown) {
    super(STORAGE_FULL_MESSAGE, { cause });
    this.name = "StorageQuotaError";
  }
}

export { isQuotaExceededError };

export interface QuotaRecoveryOptions {
  // Also drop the downloaded exercise pictures (re-downloadable from Settings). Worth it for a
  // set or a session; not for something optional like a custom timer sound.
  clearImageCache?: boolean;
}

// Frees storage that only holds copies of server data.
export async function freeNonCriticalStorage({ clearImageCache = true }: QuotaRecoveryOptions = {}) {
  try {
    await offlineDb.queryCache.clear();
  } catch {
    // Nothing to gain here; the retry decides.
  }
  if (clearImageCache) await clearPack();
}

// Most callers fire their write from a tap without an error slot in the UI (logging a set, saving
// cardio), so the message is shown here directly — at most once per half minute, not per write —
// as a toast (StorageFullToastHost) that doesn't block the page the way window.alert did.
const NOTIFY_INTERVAL_MS = 30_000;
let lastNotifiedAt = 0;

function notifyStorageFull() {
  const now = Date.now();
  if (now - lastNotifiedAt < NOTIFY_INTERVAL_MS) return;
  lastNotifiedAt = now;
  useStorageNoticeStore.getState().show(STORAGE_FULL_MESSAGE);
}

export async function writeWithQuotaRecovery<T>(operation: () => Promise<T>, options: QuotaRecoveryOptions = {}): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isQuotaExceededError(error)) throw error;
    console.warn("Storage quota exceeded, freeing caches and retrying once", error);
  }
  await freeNonCriticalStorage(options);
  try {
    return await operation();
  } catch (error) {
    if (!isQuotaExceededError(error)) throw error;
    notifyStorageFull();
    throw new StorageQuotaError(error);
  }
}

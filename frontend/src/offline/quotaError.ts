// Kept free of imports on purpose: queryClient.ts needs this check at boot, and pulling in
// storageQuota.ts (Dexie, the image pack) there would put IndexedDB code into the login page's
// first download.

const QUOTA_NAMES = new Set(["QuotaExceededError", "NS_ERROR_DOM_QUOTA_REACHED"]);

// Dexie passes the browser's DOMException on under the same name, or wraps it (`inner`) when it
// aborted a whole transaction; legacy browsers only set the numeric code 22.
export function isQuotaExceededError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth++) {
    const e = current as { name?: unknown; code?: unknown; inner?: unknown; cause?: unknown };
    if (typeof e.name === "string" && QUOTA_NAMES.has(e.name)) return true;
    if (typeof DOMException !== "undefined" && current instanceof DOMException && e.code === 22) return true;
    current = e.inner ?? e.cause;
  }
  return false;
}

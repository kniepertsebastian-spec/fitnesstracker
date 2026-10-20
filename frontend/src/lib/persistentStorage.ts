// Asks the browser to keep this origin's storage (IndexedDB: sets logged offline that aren't
// synced yet, the cached plan) out of its eviction pool (roadmap3 P2.5). Without it the browser
// may wipe the data under storage pressure — and iOS after a week without use.
//
// Chrome and Safari decide silently (installed app, engagement, notifications granted); Firefox
// shows a permission prompt, so a refusal isn't asked again for a week.
const LAST_ASKED_KEY = "fitnesstracker.storage-persist-asked-at";
const ASK_AGAIN_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export async function requestPersistentStorage(now = Date.now()): Promise<boolean> {
  try {
    if (!navigator.storage?.persist || !navigator.storage.persisted) return false;
    if (await navigator.storage.persisted()) return true;
    const lastAsked = Number(localStorage.getItem(LAST_ASKED_KEY) ?? 0);
    if (now - lastAsked < ASK_AGAIN_AFTER_MS) return false;
    localStorage.setItem(LAST_ASKED_KEY, String(now));
    return await navigator.storage.persist();
  } catch {
    // Unsupported, or storage/permissions unavailable — the app works the same, just evictable.
    return false;
  }
}

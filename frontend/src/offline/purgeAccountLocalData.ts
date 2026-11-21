import { offlineDb } from "./db";
import { lastKnownAccountId } from "./account";
import { catalogVersionKey } from "./exerciseCatalog";
import { PLAN_QUEUE_KEY, readAllQueuedPlanOps } from "./planOpQueue";
import { refreshSyncCounts } from "./syncCounts";

// After an account is deleted on the server nothing of it may stay on this device: no sets,
// sessions, cardio entries, queued or failed changes, cached plan/profile/photo data, and no
// per-account or per-workout keys in localStorage. Other accounts' rows on a shared device stay.

// Tables whose rows carry the owning account.
const ACCOUNT_TABLES = [
  "workoutLogs",
  "pendingMutations",
  "workoutSessions",
  "pendingSessionMutations",
  "failedMutations",
  "pendingCardioLogs",
  "exerciseCatalog",
] as const;

// localStorage keys of a workout or of the user's training (not tagged with an account id, so
// they all go): focus-mode plan edits, section progress, stopwatches, stretching state, weight
// steps per exercise, chart selection and dismissed plan hints.
const KEY_PREFIXES = [
  "fitnesstracker.training-edits.",
  "training-stages:",
  "training-stretch:",
  "training-prestretch:",
  "stopwatch:",
  "stretch-",
  "weightStep:",
];
const EXACT_KEYS = ["progress-chart", "phase-template-dismissed"];

function localStorageKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key !== null) keys.push(key);
  }
  return keys;
}

function purgeLocalStorage(accountId: string, ownsUnclaimed: boolean) {
  try {
    // Only this account's plan changes; another account's pending ones on this device stay.
    const remaining = readAllQueuedPlanOps().filter((q) => (q.accountId ? q.accountId !== accountId : !ownsUnclaimed));
    if (remaining.length > 0) localStorage.setItem(PLAN_QUEUE_KEY, JSON.stringify(remaining));
    else localStorage.removeItem(PLAN_QUEUE_KEY);

    const syncKey = `fitnesstracker.workout-logs-sync.${accountId}`;
    for (const key of localStorageKeys()) {
      if (key === syncKey || EXACT_KEYS.includes(key) || KEY_PREFIXES.some((p) => key.startsWith(p))) {
        localStorage.removeItem(key);
      }
    }
  } catch (error) {
    console.error("Could not clear local storage of the deleted account", error);
  }
}

export async function purgeAccountLocalData(accountId: string): Promise<void> {
  // Rows from before rows carried an account id are claimed by the account last signed in here.
  const ownsUnclaimed = lastKnownAccountId() === accountId;
  const owned = (row: { accountId?: string }) => row.accountId === accountId || (ownsUnclaimed && !row.accountId);

  const tables = ACCOUNT_TABLES.map((name) => offlineDb.table(name));
  await offlineDb.transaction("rw", [...tables, offlineDb.catalogMeta, offlineDb.queryCache, offlineDb.customSounds], async () => {
    for (const table of tables) {
      await table.filter(owned).delete();
    }
    await offlineDb.catalogMeta.delete(catalogVersionKey(accountId));
    // The persisted query cache only ever holds the signed-in account's data (plan, goals,
    // profile, …); the custom timer sound is the user's own upload.
    await offlineDb.queryCache.clear();
    await offlineDb.customSounds.clear();
  });

  purgeLocalStorage(accountId, ownsUnclaimed);
  await refreshSyncCounts();
}

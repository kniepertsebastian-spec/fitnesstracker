import type { ExerciseDto } from "@fitnesstracker/shared";
import { getExerciseCatalogRequest } from "../api/exercise.api";
import { currentAccountId } from "./account";
import { offlineDb, type LocalExercise } from "./db";

// The exercise catalog (≈ 900 exercises with names, descriptions, muscles and image addresses) is kept
// on the device. The server tells with a version whether anything changed, so keeping it current costs a
// tiny request, and everything that needs exercises — the library, the pickers, the technique sheet in the
// focus mode — reads it from here and works without a connection.

const versionKey = (accountId: string) => `catalog-version:${accountId}`;
// A sync more often than this is pointless: the question is cheap but the answer rarely changes.
const MIN_SYNC_INTERVAL_MS = 60_000;
let lastSyncAt = 0;
let syncing: Promise<boolean> | null = null;

export async function readExerciseCatalog(): Promise<ExerciseDto[]> {
  const accountId = currentAccountId();
  if (!accountId) return [];
  const rows = await offlineDb.exerciseCatalog.where("accountId").equals(accountId).toArray();
  // Same order the server uses: German name first.
  return rows.map(({ accountId: _account, ...rest }) => rest as ExerciseDto).sort((a, b) => a.name.localeCompare(b.name, "de"));
}

export async function catalogInfo(): Promise<{ count: number; version: string | null }> {
  const accountId = currentAccountId();
  if (!accountId) return { count: 0, version: null };
  const [count, meta] = await Promise.all([
    offlineDb.exerciseCatalog.where("accountId").equals(accountId).count(),
    offlineDb.catalogMeta.get(versionKey(accountId)),
  ]);
  return { count, version: meta?.value ?? null };
}

// Asks the server whether the catalog changed and replaces the local copy if so. Returns whether new data
// arrived. Never throws: offline or a failed request simply leaves the copy as it is.
export function syncExerciseCatalog(force = false): Promise<boolean> {
  if (syncing) return syncing;
  const accountId = currentAccountId();
  if (!accountId || !navigator.onLine) return Promise.resolve(false);
  if (!force && Date.now() - lastSyncAt < MIN_SYNC_INTERVAL_MS) return Promise.resolve(false);

  syncing = (async () => {
    try {
      const known = (await offlineDb.catalogMeta.get(versionKey(accountId)))?.value;
      const have = known ? await offlineDb.exerciseCatalog.where("accountId").equals(accountId).count() : 0;
      // Without rows a stored version means nothing (the table was cleared): ask for the whole list.
      const response = await getExerciseCatalogRequest(have > 0 ? known : undefined);
      lastSyncAt = Date.now();
      if (currentAccountId() !== accountId) return false;
      if (response.unchanged || !response.items) return false;
      await offlineDb.transaction("rw", offlineDb.exerciseCatalog, offlineDb.catalogMeta, async () => {
        await offlineDb.exerciseCatalog.where("accountId").equals(accountId).delete();
        await offlineDb.exerciseCatalog.bulkPut(response.items!.map((e): LocalExercise => ({ ...e, accountId })));
        await offlineDb.catalogMeta.put({ key: versionKey(accountId), value: response.version });
      });
      return true;
    } catch {
      return false;
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

// Sync (if online and due), then read: what the hooks call.
export async function loadExerciseCatalog(force = false): Promise<ExerciseDto[]> {
  await syncExerciseCatalog(force);
  return readExerciseCatalog();
}

let initialized = false;

// Called once at app start: fetch the catalog again whenever the connection returns (the first fetch
// happens when someone signs in, see App.tsx).
export function initExerciseCatalogSync() {
  if (initialized) return;
  initialized = true;
  window.addEventListener("online", () => void syncExerciseCatalog(true));
}

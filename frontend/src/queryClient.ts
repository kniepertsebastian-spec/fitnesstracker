import { QueryClient, type Query } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { PersistQueryClientOptions } from "@tanstack/react-query-persist-client";
import { offlineDb } from "./offline/db";

const DAY_MS = 24 * 60 * 60 * 1000;
const PERSIST_MAX_AGE_MS = 14 * DAY_MS;

// A module-level singleton (rather than one created inside main.tsx) so code outside the React
// tree — the offline sync manager's online-event handler in particular — can push fresh data
// into the cache too, not just components via useQueryClient().
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      // Kept at least as long as the persisted copy, or restored data would be dropped again.
      gcTime: PERSIST_MAX_AGE_MS,
    },
  },
});

// What a workout and the dashboard need when the app is opened without signal (roadmap3 P1.2).
// Sets, sessions and cardio entries have their own IndexedDB stores (offline/*); photos, search
// results and drafts are left out on purpose.
const PERSISTED_PREFIXES = new Set([
  "training-plan",
  "plan-exercises",
  "cardio",
  "stretching",
  "exercise",
  "exercises",
  "daily-challenge",
  "goals",
  "profile",
]);

function shouldPersist(query: Query): boolean {
  const [prefix] = query.queryKey;
  return query.state.status === "success" && typeof prefix === "string" && PERSISTED_PREFIXES.has(prefix);
}

const CACHE_KEY = "react-query";

const persister = createAsyncStoragePersister({
  key: CACHE_KEY,
  storage: {
    getItem: async (key) => (await offlineDb.queryCache.get(key))?.value ?? null,
    setItem: async (key, value) => {
      await offlineDb.queryCache.put({ key, value });
    },
    removeItem: async (key) => {
      await offlineDb.queryCache.delete(key);
    },
  },
  throttleTime: 2000,
});

export const persistOptions: Omit<PersistQueryClientOptions, "queryClient"> = {
  persister,
  maxAge: PERSIST_MAX_AGE_MS,
  // A new build may change response shapes — start from a fresh cache then.
  buster: __BUILD_ID__,
  dehydrateOptions: { shouldDehydrateQuery: shouldPersist },
};

// On logout or a lost session: nothing of this account may be shown to the next one.
export async function clearQueryCache() {
  queryClient.clear();
  await persister.removeClient();
}

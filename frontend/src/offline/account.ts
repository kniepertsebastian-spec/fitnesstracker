import { ApiError } from "../api/client";
import { readCachedUser, useAuthStore } from "../stores/authStore";

// Everything kept on the device for syncing (sets, sessions, cardio, plan changes) belongs to the
// account that made it. These helpers decide whose rows the current screen may read or send.
export function currentAccountId(): string | null {
  return useAuthStore.getState().user?.id ?? null;
}

// Last account that was signed in on this device — used once, to claim rows written before they
// carried an account id, so nothing from an older version of the app is left orphaned.
export function lastKnownAccountId(): string | null {
  return readCachedUser()?.id ?? null;
}

// Whether a failed request says something about the request itself (so retrying the identical
// request can never work) or only about the moment (server error, rate limit, expired session).
// Only the former may end up in the "failed" list; the latter stays queued and is sent again
// later — an entry the user made is never discarded because the server happened to be down.
export function isTransientFailure(error: unknown): boolean {
  if (!(error instanceof ApiError)) return true;
  return error.status >= 500 || [401, 403, 408, 425, 429].includes(error.status);
}

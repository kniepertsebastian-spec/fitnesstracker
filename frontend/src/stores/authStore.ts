import { create } from "zustand";
import type { UserDto } from "@fitnesstracker/shared";

interface AuthState {
  user: UserDto | null;
  accessToken: string | null;
  status: "idle" | "loading" | "authenticated" | "unauthenticated";
  setSession: (user: UserDto, accessToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  clearSession: () => void;
  setStatus: (status: AuthState["status"]) => void;
}

// Not the access token (that stays memory-only, see below) — just enough to recognize "someone
// was logged in on this device" across a reload without a network round-trip. An XSS payload
// reading this only learns the account's own email/displayName, which an authenticated page's
// DOM already exposes; it grants no capability the token doesn't already guard.
const CACHED_USER_KEY = "fitnesstracker.cached-user";

function readCachedUser(): UserDto | null {
  try {
    const raw = localStorage.getItem(CACHED_USER_KEY);
    return raw ? (JSON.parse(raw) as UserDto) : null;
  } catch {
    return null;
  }
}

function writeCachedUser(user: UserDto | null) {
  try {
    if (user) localStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(CACHED_USER_KEY);
  } catch {
    // Storage can be unavailable (private browsing, quota) — losing this fallback is fine, it
    // just means a reload while offline degrades to the ordinary logged-out screen instead.
  }
}

// Access token lives only in memory (this store), never localStorage — keeps it out of
// reach of any XSS payload that could read localStorage. Persistence across reloads comes
// from the httpOnly refresh cookie via a silent /auth/refresh call on app boot; see
// useAuthBootstrap in hooks/useAuth.ts for what happens when that call fails offline rather
// than because the session is genuinely invalid.
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  status: "idle",
  setSession: (user, accessToken) => {
    writeCachedUser(user);
    set({ user, accessToken, status: "authenticated" });
  },
  setAccessToken: (accessToken) => set({ accessToken }),
  clearSession: () => {
    writeCachedUser(null);
    set({ user: null, accessToken: null, status: "unauthenticated" });
  },
  setStatus: (status) => set({ status }),
}));

export { readCachedUser };

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

// Access token lives only in memory (this store), never localStorage — keeps it out of
// reach of any XSS payload that could read localStorage. Persistence across reloads comes
// from the httpOnly refresh cookie via a silent /auth/refresh call on app boot.
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  status: "idle",
  setSession: (user, accessToken) => set({ user, accessToken, status: "authenticated" }),
  setAccessToken: (accessToken) => set({ accessToken }),
  clearSession: () => set({ user: null, accessToken: null, status: "unauthenticated" }),
  setStatus: (status) => set({ status }),
}));

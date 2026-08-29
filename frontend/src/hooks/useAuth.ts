import { useCallback, useEffect } from "react";
import type { LoginInput, RegisterInput } from "@fitnesstracker/shared";
import { loginRequest, logoutRequest, meRequest, registerRequest } from "../api/auth.api";
import { ApiError, apiFetch } from "../api/client";
import { readCachedUser, useAuthStore } from "../stores/authStore";

// On app boot there's no access token in memory yet (it's never persisted), so we try a
// silent refresh against the httpOnly cookie first; only if that fails is the user logged out.
export function useAuthBootstrap() {
  const setSession = useAuthStore((s) => s.setSession);
  const setStatus = useAuthStore((s) => s.setStatus);
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    if (status !== "idle") return;
    setStatus("loading");

    apiFetch<{ accessToken: string }>("/auth/refresh", { method: "POST", skipAuthRetry: true })
      .then(async (data) => {
        useAuthStore.getState().setAccessToken(data.accessToken);
        const user = await meRequest();
        setSession(user, data.accessToken);
      })
      .catch((error) => {
        // ApiError means the server was reached and said the refresh token is invalid/expired —
        // that's a genuine logout. Anything else (fetch itself rejecting) means the request
        // never reached the server at all — most commonly a reload while offline — which says
        // nothing about whether the session is still valid. Falling back to the last-known user
        // instead of logging out is what lets "App neu laden" while offline keep showing the
        // app (backed by the locally cached IndexedDB data) instead of bouncing to /login; a
        // stale/actually-revoked session still gets caught the moment any real request 401s and
        // the retry-refresh in api/client.ts fails for real.
        if (error instanceof ApiError) {
          useAuthStore.getState().clearSession();
          return;
        }
        const cachedUser = readCachedUser();
        if (cachedUser) {
          setSession(cachedUser, "");
        } else {
          useAuthStore.getState().clearSession();
        }
      });
  }, [status, setSession, setStatus]);
}

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);

  const login = useCallback(
    async (input: LoginInput) => {
      const data = await loginRequest(input);
      setSession(data.user, data.accessToken);
    },
    [setSession],
  );

  const register = useCallback((input: RegisterInput) => registerRequest(input), []);

  const logout = useCallback(async () => {
    await logoutRequest().catch(() => undefined);
    clearSession();
  }, [clearSession]);

  return { user, status, login, register, logout };
}

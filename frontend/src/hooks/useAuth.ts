import { useCallback, useEffect } from "react";
import type { LoginInput, RegisterInput } from "@fitnesstracker/shared";
import { loginRequest, logoutRequest, meRequest, registerRequest } from "../api/auth.api";
import { apiFetch } from "../api/client";
import { useAuthStore } from "../stores/authStore";

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
      .catch(() => {
        useAuthStore.getState().clearSession();
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

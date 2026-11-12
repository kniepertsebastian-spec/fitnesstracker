import { flushPendingLogout, hasPendingLogout } from "../lib/pendingLogout";
import { useAuthStore } from "../stores/authStore";

const BASE_URL = "/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// "rejected": the server said the session is over (401/403). "unavailable": no answer, or a 5xx —
// says nothing about the session, so the user stays signed in and the request just fails.
type RefreshResult = "ok" | "rejected" | "unavailable";

let refreshPromise: Promise<RefreshResult> | null = null;

async function refreshAccessToken(): Promise<RefreshResult> {
  // The user logged out while the server could not be reached: finish that instead of
  // refreshing — the session must not come back to life.
  if (hasPendingLogout()) {
    await flushPendingLogout();
    return "rejected";
  }
  if (!refreshPromise) {
    refreshPromise = fetch(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) return "rejected";
        if (!res.ok) return "unavailable";
        const data = await res.json();
        useAuthStore.getState().setAccessToken(data.accessToken);
        return "ok";
      })
      .catch((): RefreshResult => "unavailable")
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  skipAuthRetry?: boolean;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, skipAuthRetry = false } = options;
  const accessToken = useAuthStore.getState().accessToken;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    credentials: "include",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !skipAuthRetry) {
    const refreshed = await refreshAccessToken();
    if (refreshed === "ok") {
      return apiFetch<T>(path, { ...options, skipAuthRetry: true });
    }
    if (refreshed === "rejected") useAuthStore.getState().clearSession();
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, data.message ?? "Request failed");
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}

export async function apiUpload<T>(path: string, formData: FormData, skipAuthRetry = false): Promise<T> {
  const accessToken = useAuthStore.getState().accessToken;

  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    body: formData,
  });

  if (res.status === 401 && !skipAuthRetry) {
    const refreshed = await refreshAccessToken();
    if (refreshed === "ok") {
      return apiUpload<T>(path, formData, true);
    }
    if (refreshed === "rejected") useAuthStore.getState().clearSession();
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, data.message ?? "Request failed");
  }

  return res.json();
}

export async function apiFetchBlob(path: string, skipAuthRetry = false): Promise<Blob> {
  const accessToken = useAuthStore.getState().accessToken;

  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: "include",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });

  if (res.status === 401 && !skipAuthRetry) {
    const refreshed = await refreshAccessToken();
    if (refreshed === "ok") {
      return apiFetchBlob(path, true);
    }
    if (refreshed === "rejected") useAuthStore.getState().clearSession();
  }

  if (!res.ok) {
    throw new ApiError(res.status, res.statusText);
  }

  return res.blob();
}

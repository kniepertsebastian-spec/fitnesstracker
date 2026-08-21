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

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) return false;
        const data = await res.json();
        useAuthStore.getState().setAccessToken(data.accessToken);
        return true;
      })
      .catch(() => false)
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
    if (refreshed) {
      return apiFetch<T>(path, { ...options, skipAuthRetry: true });
    }
    useAuthStore.getState().clearSession();
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
    if (refreshed) {
      return apiUpload<T>(path, formData, true);
    }
    useAuthStore.getState().clearSession();
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
    if (refreshed) {
      return apiFetchBlob(path, true);
    }
    useAuthStore.getState().clearSession();
  }

  if (!res.ok) {
    throw new ApiError(res.status, res.statusText);
  }

  return res.blob();
}

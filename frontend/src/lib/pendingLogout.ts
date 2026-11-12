// A logout that could not reach the server (offline, 5xx) must not leave the session alive: the
// httpOnly refresh cookie would sign the user straight back in on the next reload. The intent is
// remembered here and carried out before the next silent refresh (app start, expired access token)
// or the next login.
const KEY = "fitnesstracker.pending-logout";

export function markPendingLogout() {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // Storage unavailable: nothing to remember it in; the cookie is then all that is left.
  }
}

export function hasPendingLogout(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function clearPendingLogout() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // see markPendingLogout
  }
}

/** Tells the server to end the remembered session. Resolves true once nothing is pending anymore. */
export async function flushPendingLogout(): Promise<boolean> {
  if (!hasPendingLogout()) return true;
  try {
    const res = await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    // 4xx: the server will never accept it either (nothing to revoke) — don't retry forever.
    if (res.ok || (res.status >= 400 && res.status < 500)) {
      clearPendingLogout();
      return true;
    }
  } catch {
    // still offline
  }
  return false;
}

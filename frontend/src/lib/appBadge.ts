// Home-screen badge (installed PWA): a number for sets/changes not yet synced, a plain dot while a
// workout session is open. Unsupported browsers and failures are ignored — it's only a hint.
export function updateAppBadge(pendingCount: number, sessionOpen: boolean): void {
  const nav = navigator as Navigator & {
    setAppBadge?: (count?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  if (!nav.setAppBadge || !nav.clearAppBadge) return;
  const apply =
    pendingCount > 0 ? nav.setAppBadge(pendingCount) : sessionOpen ? nav.setAppBadge() : nav.clearAppBadge();
  apply.catch(() => undefined);
}

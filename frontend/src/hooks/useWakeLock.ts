import { useEffect } from "react";

// Keeps the screen on while `active` (the focus mode during a workout) — no more unlocking the
// phone between sets. The browser drops the lock whenever the page is hidden, so it's requested
// again on every return. Unsupported browsers simply keep their normal screen timeout.
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const next = await navigator.wakeLock.request("screen");
        if (cancelled) void next.release();
        else lock = next;
      } catch {
        // Denied (battery saver, not focused) — nothing to do.
      }
    };
    void request();
    const onVisibility = () => void request();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void lock?.release().catch(() => undefined);
    };
  }, [active]);
}

import { useRegisterSW } from "virtual:pwa-register/react";
import { Button } from "../ui";

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

// A browser only checks for a new service worker on navigation. An installed PWA that stays open
// (or is merely brought back from the background) never navigates, so a deploy would go unnoticed
// until the app was killed. Ask for an update when the app becomes visible again and every hour.
// Offline `update()` rejects — that is expected and ignored.
function watchForUpdates(registration: ServiceWorkerRegistration): () => void {
  const check = () => {
    if (!navigator.onLine) return;
    registration.update().catch(() => undefined);
  };
  const onVisible = () => {
    if (document.visibilityState === "visible") check();
  };
  const timer = window.setInterval(check, UPDATE_CHECK_INTERVAL_MS);
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

// Mounted once at app level (App.tsx). `registerType: "prompt"` in vite.config.ts leaves a newly
// built service worker sitting in the "waiting" state instead of taking over immediately —
// swapping in a different JS bundle mid-session risked breaking whatever the user was doing
// (e.g. a half-filled set) with no warning. This banner tells the waiting worker to activate,
// once the user asks for it. `suppressed` hides it during a workout (focus mode): the hook keeps
// running, so the prompt appears right after the training instead of reloading mid-set.
export function UpdatePrompt({ suppressed = false }: { suppressed?: boolean }) {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      // Mounted once for the whole app lifetime, so the listeners are never torn down.
      if (registration) watchForUpdates(registration);
    },
    onRegisterError(error) {
      console.error("Service worker registration failed", error);
    },
  });

  if (!needRefresh || suppressed) return null;

  return (
    <div
      role="status"
      className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-4 right-20 z-30 flex flex-col gap-2 rounded-2xl border border-accent-border bg-surface p-3 shadow-overlay lg:left-auto lg:right-6 lg:w-80"
    >
      <p className="text-small text-text-2">Neue Version verfügbar</p>
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setNeedRefresh(false)}>
          Später
        </Button>
        <Button variant="primary" size="sm" onClick={() => updateServiceWorker(true)}>
          Aktualisieren
        </Button>
      </div>
    </div>
  );
}

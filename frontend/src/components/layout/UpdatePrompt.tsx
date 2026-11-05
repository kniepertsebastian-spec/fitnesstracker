import { useRegisterSW } from "virtual:pwa-register/react";
import { Button } from "../ui";

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

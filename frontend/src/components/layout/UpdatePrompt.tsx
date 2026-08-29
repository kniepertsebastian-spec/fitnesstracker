import { useRegisterSW } from "virtual:pwa-register/react";

// Mounted once in AppShell. `registerType: "prompt"` in vite.config.ts leaves a newly built
// service worker sitting in the "waiting" state instead of taking over immediately — swapping in
// a different JS bundle mid-session (the previous "autoUpdate" default) risked breaking whatever
// the user was doing (e.g. a half-filled set) with no warning. This banner is what finally tells
// the waiting worker to activate, once the user asks for it.
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error("Service worker registration failed", error);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-4 right-20 z-30 flex flex-col gap-2 rounded-xl border border-violet-800 bg-ink-900 p-3 shadow-lg">
      <p className="text-sm text-ink-200">Neue Version verfügbar</p>
      <div className="flex items-center justify-end gap-3">
        <button onClick={() => setNeedRefresh(false)} className="text-xs text-ink-500 hover:text-ink-300">
          Später
        </button>
        <button
          onClick={() => updateServiceWorker(true)}
          className="rounded-lg bg-violet-500 px-3 py-1 text-xs font-medium text-ink-950 hover:bg-violet-400"
        >
          Aktualisieren
        </button>
      </div>
    </div>
  );
}

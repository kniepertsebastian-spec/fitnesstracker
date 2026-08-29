import { usePRToastStore } from "../../stores/prToastStore";

// Mounted once in AppShell so a PR fires from anywhere a set gets logged (the plan diary, the
// freeform "+ Satz" dialog) without each of those needing to know about toast rendering — top of
// screen, clear of the bottom-right rest timer widget.
export function PRToastHost() {
  const { toasts, dismiss } = usePRToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed left-0 right-0 top-[calc(0.75rem+env(safe-area-inset-top))] z-40 flex flex-col items-center gap-2 px-4">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          onClick={() => dismiss(toast.id)}
          className="pointer-events-auto w-full max-w-sm rounded-xl border border-emerald-800 bg-emerald-950 px-4 py-2.5 text-left shadow-lg"
        >
          <p className="text-sm font-medium text-emerald-300">🏆 Neuer Rekord — {toast.exerciseName}</p>
          <p className="text-xs text-emerald-500">{toast.labels.join(" · ")}</p>
        </button>
      ))}
    </div>
  );
}

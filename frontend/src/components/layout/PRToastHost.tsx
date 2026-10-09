import { Trophy } from "lucide-react";
import { usePRToastStore } from "../../stores/prToastStore";
import { Toast } from "../ui";

// Mounted once in AppShell so a PR fires from anywhere a set gets logged (the plan diary, the
// freeform "+ Satz" dialog) without each of those needing to know about toast rendering — top of
// screen, clear of the bottom-right rest timer widget.
export function PRToastHost() {
  const { toasts, dismiss } = usePRToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed left-0 right-0 top-[calc(0.75rem+env(safe-area-inset-top))] z-[60] flex flex-col items-center gap-2 px-4">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          onClick={() => dismiss(toast.id)}
          className="pointer-events-auto w-full max-w-sm text-left"
          aria-label="Meldung schließen"
        >
          <Toast icon={<Trophy size={20} strokeWidth={1.8} />} overline="Neuer Rekord">
            {toast.exerciseName}
            <span className="block text-small font-normal text-text-subtle">{toast.labels.join(" · ")}</span>
          </Toast>
        </button>
      ))}
    </div>
  );
}

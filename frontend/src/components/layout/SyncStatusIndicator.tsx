import { useEffect, useRef, useState } from "react";
import { useSyncStore } from "../../stores/syncStore";
import { retryAllFailedMutations, retryFailedMutation } from "../../offline/retry";
import type { MutationOp } from "../../offline/db";

const OP_LABELS: Record<MutationOp, string> = {
  create: "Erstellen",
  update: "Bearbeiten",
  delete: "Löschen",
};

// Always visible, not just when something's wrong — "Der Nutzer soll jederzeit verstehen, ob
// seine Daten sicher gespeichert und synchronisiert sind" means an all-clear state needs its own
// affirmative signal too, not just the absence of a warning badge. Priority for the compact pill
// when multiple things are true at once: a failure needs attention before "syncing" or "offline"
// are worth mentioning, and being offline explains why something is still pending better than
// just showing the pending count on its own.
export function SyncStatusIndicator() {
  const { isOnline, isSyncing, pendingCount, failedCount, failedMutations } = useSyncStore();
  const [open, setOpen] = useState(false);
  const [retryingAll, setRetryingAll] = useState(false);
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  // Pending count rides along with whichever state is otherwise shown (rather than only
  // appearing in its own "X ausstehend" state) — being offline or mid-retry explains *why*
  // something is still pending, but shouldn't hide *how much* still is.
  const pendingSuffix = pendingCount > 0 ? ` · ${pendingCount} ausstehend` : "";
  const pill =
    failedCount > 0
      ? { text: `${failedCount} fehlgeschlagen`, className: "bg-red-950 text-red-400" }
      : !isOnline
        ? { text: `Offline${pendingSuffix}`, className: "bg-amber-950 text-amber-400" }
        : isSyncing
          ? { text: `Synchronisiert…${pendingSuffix}`, className: "bg-violet-950 text-violet-400" }
          : pendingCount > 0
            ? { text: `${pendingCount} ausstehend`, className: "bg-ink-800 text-ink-400" }
            : { text: "Synchronisiert", className: "bg-emerald-950 text-emerald-400" };

  const handleRetry = async (id: number, mutation: Parameters<typeof retryFailedMutation>[0]) => {
    setRetryingId(id);
    try {
      await retryFailedMutation(mutation);
    } finally {
      setRetryingId(null);
    }
  };

  const handleRetryAll = async () => {
    setRetryingAll(true);
    try {
      await retryAllFailedMutations(failedMutations);
    } finally {
      setRetryingAll(false);
    }
  };

  return (
    <div ref={panelRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`rounded-full px-2 py-0.5 text-xs font-medium ${pill.className}`}
      >
        {pill.text}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-lg border border-ink-800 bg-ink-900 p-3 shadow-lg">
          <p className="text-xs text-ink-500">
            {failedCount > 0
              ? "Einige Änderungen konnten nicht synchronisiert werden — deine Daten sind aber lokal gespeichert."
              : !isOnline
                ? `Keine Verbindung — Änderungen werden lokal gespeichert${pendingCount > 0 ? ` (${pendingCount} wartend)` : ""} und automatisch synchronisiert, sobald du wieder online bist.`
                : isSyncing
                  ? `Synchronisierung läuft…${pendingCount > 0 ? ` (${pendingCount} verbleibend)` : ""}`
                  : pendingCount > 0
                    ? `${pendingCount} Änderung${pendingCount === 1 ? "" : "en"} wird${pendingCount === 1 ? "" : "en"} synchronisiert.`
                    : "Alle Änderungen sind synchronisiert."}
          </p>

          {failedMutations.length > 0 && (
            <div className="mt-3 flex flex-col gap-2 border-t border-ink-800 pt-3">
              {failedMutations.map((mutation) => (
                <div key={mutation.id} className="rounded-lg bg-ink-800 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-medium text-ink-200">
                      {mutation.label} · {OP_LABELS[mutation.op]}
                    </p>
                    <button
                      onClick={() => handleRetry(mutation.id as number, mutation)}
                      disabled={retryingId === mutation.id || retryingAll}
                      className="shrink-0 rounded-lg bg-ink-700 px-2 py-0.5 text-xs text-ink-200 hover:bg-ink-600 disabled:opacity-50"
                    >
                      {retryingId === mutation.id ? "…" : "Erneut versuchen"}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-red-400">{mutation.reason}</p>
                </div>
              ))}

              {failedMutations.length > 1 && (
                <button
                  onClick={handleRetryAll}
                  disabled={retryingAll}
                  className="rounded-lg bg-violet-500 py-1.5 text-xs font-medium text-ink-950 hover:bg-violet-400 disabled:opacity-50"
                >
                  {retryingAll ? "Wird erneut versucht…" : "Alle erneut versuchen"}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

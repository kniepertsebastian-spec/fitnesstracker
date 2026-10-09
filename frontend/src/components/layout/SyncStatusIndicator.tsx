import { useEffect, useRef, useState } from "react";
import { useSyncStore } from "../../stores/syncStore";
import { retryAllFailedMutations, retryFailedMutation } from "../../offline/retry";
import type { MutationOp } from "../../offline/db";
import { StatusPill } from "../ui";
import type { StatusPillTone } from "../ui";

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
  const pill: { text: string; tone: StatusPillTone } =
    failedCount > 0
      ? { text: `${failedCount} fehlgeschlagen`, tone: "failed" }
      : !isOnline
        ? { text: `Offline${pendingSuffix}`, tone: "offline" }
        : isSyncing
          ? { text: `Synchronisiert…${pendingSuffix}`, tone: "syncing" }
          : pendingCount > 0
            ? { text: `${pendingCount} ausstehend`, tone: "pending" }
            : { text: "Synchronisiert", tone: "synced" };

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
      <StatusPill tone={pill.tone} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {pill.text}
      </StatusPill>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-xl border border-border bg-surface p-3 shadow-overlay">
          <p className="text-xs text-text-subtle">
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
            <div className="mt-3 flex flex-col gap-2 border-t border-border-subtle pt-3">
              {failedMutations.map((mutation) => (
                <div key={mutation.id} data-testid="failed-mutation" className="rounded-lg bg-surface-2 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-medium text-text-2">
                      {mutation.label} · {OP_LABELS[mutation.op]}
                    </p>
                    <button
                      onClick={() => handleRetry(mutation.id as number, mutation)}
                      disabled={retryingId === mutation.id || retryingAll}
                      className="shrink-0 rounded-md bg-control px-2 py-1 text-xs text-text-2 hover:bg-track disabled:opacity-50"
                    >
                      {retryingId === mutation.id ? "…" : "Erneut versuchen"}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-danger-text">{mutation.reason}</p>
                </div>
              ))}

              {failedMutations.length > 1 && (
                <button
                  onClick={handleRetryAll}
                  disabled={retryingAll}
                  className="rounded-md bg-accent py-2 text-xs font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-50"
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

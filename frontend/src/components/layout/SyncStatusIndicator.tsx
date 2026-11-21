import { useEffect, useId, useRef, useState } from "react";
import { useSyncStore } from "../../stores/syncStore";
import {
  canDiscardFailedMutation,
  discardFailedMutation,
  retryAllFailedMutations,
  retryFailedMutation,
} from "../../offline/retry";
import type { FailedMutation, MutationOp } from "../../offline/db";
import { Button, StatusPill } from "../ui";
import type { StatusPillTone } from "../ui";

const OP_LABELS: Record<MutationOp, string> = {
  create: "Erstellen",
  update: "Bearbeiten",
  delete: "Löschen",
};

// A plan change's label already names what happened ("Plan: Übung entfernt", see
// planOpLabel in offline/planEditSync.ts) — the generic create/update/delete suffix would only
// repeat it less precisely.
function failedMutationTitle(mutation: FailedMutation) {
  return mutation.kind === "planEdit" ? mutation.label : `${mutation.label} · ${OP_LABELS[mutation.op]}`;
}

// Always visible, not just when something's wrong — "Der Nutzer soll jederzeit verstehen, ob
// seine Daten sicher gespeichert und synchronisiert sind" means an all-clear state needs its own
// affirmative signal too, not just the absence of a warning badge. Priority for the compact pill
// when multiple things are true at once: a failure needs attention before "syncing" or "offline"
// are worth mentioning, and being offline explains why something is still pending better than
// just showing the pending count on its own.
//
// The panel is a non-modal disclosure: the pill toggles it (Enter/Space, native button), focus
// stays where it is and Tab walks on into the panel. Escape closes it and puts focus back on the
// pill; a tap or click anywhere outside closes it too.
export function SyncStatusIndicator() {
  const { isOnline, isSyncing, pendingCount, failedCount, failedMutations } = useSyncStore();
  const [open, setOpen] = useState(false);
  const [retryingAll, setRetryingAll] = useState(false);
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    // pointerdown instead of mousedown: fires for touch as well, without waiting for the
    // compatibility mouse events a touch screen may send late or not at all.
    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
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

  const handleDiscard = async (id: number, mutation: Parameters<typeof discardFailedMutation>[0]) => {
    setRetryingId(id);
    try {
      await discardFailedMutation(mutation);
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
    <div ref={containerRef} className="relative min-w-0">
      <StatusPill
        ref={triggerRef}
        tone={pill.tone}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-haspopup="dialog"
      >
        {pill.text}
      </StatusPill>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Synchronisierung"
          className="absolute right-0 top-full z-20 mt-2 w-72 rounded-xl border border-border bg-surface p-3 shadow-overlay"
        >
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
              {failedMutations.map((mutation) => {
                const busy = retryingId === mutation.id || retryingAll;
                return (
                  <div key={mutation.id} data-testid="failed-mutation" className="rounded-lg bg-surface-2 p-2">
                    <p className="truncate text-xs font-medium text-text-2">{failedMutationTitle(mutation)}</p>
                    <p className="mt-1 text-xs text-danger-text">{mutation.reason}</p>
                    {/* Full 44 px touch targets — these are the only way out of a failed sync. */}
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => handleRetry(mutation.id as number, mutation)}
                        disabled={busy}
                        aria-busy={retryingId === mutation.id}
                      >
                        {retryingId === mutation.id ? "…" : "Erneut versuchen"}
                      </Button>
                      {canDiscardFailedMutation(mutation) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleDiscard(mutation.id as number, mutation)}
                          disabled={busy}
                        >
                          Verwerfen
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}

              {failedMutations.length > 1 && (
                <Button variant="primary" size="sm" fullWidth onClick={handleRetryAll} disabled={retryingAll}>
                  {retryingAll ? "Wird erneut versucht…" : "Alle erneut versuchen"}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

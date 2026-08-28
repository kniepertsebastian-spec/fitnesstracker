import { useOpenWorkoutSession, useStartWorkoutSession, useUpdateWorkoutSessionStatus } from "../../hooks/useWorkoutSession";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

// Start/Pause/Fortsetzen/Abbrechen/Abschließen as a simple button row — a lightweight lifecycle
// wrapper around a gym visit, parallel to (not gating) the existing "+ Satz" logging flow. Works
// offline the same way logging a set does: useOpenWorkoutSession/useStartWorkoutSession/
// useUpdateWorkoutSessionStatus all go through offline/workoutSessionSync.ts, which writes to
// the local Dexie cache first and queues the server call for whenever connectivity returns.
export function WorkoutSessionBar() {
  const { data: session, isLoading } = useOpenWorkoutSession();
  const start = useStartWorkoutSession();
  const updateStatus = useUpdateWorkoutSessionStatus();

  if (isLoading) return null;

  if (!session) {
    return (
      <div className="mb-4 flex items-center justify-between rounded-lg border border-ink-800 bg-ink-900 p-3">
        <p className="text-sm text-ink-400">Kein Training aktiv</p>
        <button
          onClick={() => start.mutate(crypto.randomUUID())}
          disabled={start.isPending}
          className="rounded-lg bg-violet-500 px-3 py-1.5 text-sm font-medium text-ink-950 hover:bg-violet-400"
        >
          Training starten
        </button>
      </div>
    );
  }

  const setStatus = (status: "ACTIVE" | "PAUSED" | "COMPLETED" | "ABORTED") =>
    updateStatus.mutate({ clientId: session.clientId, status });

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-800 bg-ink-900 p-3">
      <p className="text-sm text-ink-300">
        {session.status === "PAUSED" ? "Pausiert" : "Training läuft"}
        <span className="text-ink-500"> · seit {formatTime(session.startedAt)}</span>
      </p>
      <div className="flex gap-2">
        {session.status === "ACTIVE" ? (
          <button
            onClick={() => setStatus("PAUSED")}
            disabled={updateStatus.isPending}
            className="rounded-lg bg-ink-800 px-3 py-1.5 text-sm font-medium text-ink-200 hover:bg-ink-700"
          >
            Pause
          </button>
        ) : (
          <button
            onClick={() => setStatus("ACTIVE")}
            disabled={updateStatus.isPending}
            className="rounded-lg bg-violet-500 px-3 py-1.5 text-sm font-medium text-ink-950 hover:bg-violet-400"
          >
            Fortsetzen
          </button>
        )}
        <button
          onClick={() => setStatus("COMPLETED")}
          disabled={updateStatus.isPending}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-ink-950 hover:bg-emerald-500"
        >
          Abschließen
        </button>
        <button
          onClick={() => setStatus("ABORTED")}
          disabled={updateStatus.isPending}
          className="rounded-lg bg-transparent px-3 py-1.5 text-sm font-medium text-red-400 hover:text-red-300"
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}

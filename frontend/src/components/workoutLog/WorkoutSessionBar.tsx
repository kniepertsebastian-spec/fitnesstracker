import { Pause, Play } from "lucide-react";
import { useOpenWorkoutSession, useStartWorkoutSession, useUpdateWorkoutSessionStatus } from "../../hooks/useWorkoutSession";
import { Badge, Button, ButtonLink, Card } from "../ui";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

// Start/Pause/Fortsetzen/Abbrechen/Abschließen as a simple row — a lightweight lifecycle wrapper
// around a gym visit, parallel to (not gating) the freeform "+ Satz" logging flow. Works offline
// the same way logging a set does (all hooks go through offline/workoutSessionSync.ts). The
// focus mode (/training) is where a session is actually trained.
export function WorkoutSessionBar() {
  const { data: session, isLoading } = useOpenWorkoutSession();
  const start = useStartWorkoutSession();
  const updateStatus = useUpdateWorkoutSessionStatus();

  if (isLoading) return null;

  if (!session) {
    return (
      <Card className="flex items-center justify-between gap-3">
        <p className="text-body text-text-subtle">Kein Training aktiv</p>
        <Button
          variant="primary"
          disabled={start.isPending}
          onClick={() => start.mutate(crypto.randomUUID())}
        >
          Training starten
        </Button>
      </Card>
    );
  }

  const setStatus = (status: "ACTIVE" | "PAUSED" | "COMPLETED" | "ABORTED") =>
    updateStatus.mutate({ clientId: session.clientId, status });

  return (
    <Card className="flex flex-wrap items-center justify-between gap-3">
      <p className="flex items-center gap-2 text-body text-text-2">
        <Badge tone={session.status === "PAUSED" ? "warning" : "accent"}>
          {session.status === "PAUSED" ? "Pausiert" : "Training läuft"}
        </Badge>
        <span className="text-small text-text-faint">seit {formatTime(session.startedAt)}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        <ButtonLink to="/training" variant="primary" size="sm">
          Zum Fokusmodus
        </ButtonLink>
        {session.status === "ACTIVE" ? (
          <Button size="sm" iconLeft={<Pause size={14} aria-hidden />} disabled={updateStatus.isPending} onClick={() => setStatus("PAUSED")}>
            Pause
          </Button>
        ) : (
          <Button size="sm" iconLeft={<Play size={14} aria-hidden />} disabled={updateStatus.isPending} onClick={() => setStatus("ACTIVE")}>
            Fortsetzen
          </Button>
        )}
        <Button size="sm" variant="secondary" disabled={updateStatus.isPending} onClick={() => setStatus("COMPLETED")}>
          Abschließen
        </Button>
        <Button size="sm" variant="danger" disabled={updateStatus.isPending} onClick={() => setStatus("ABORTED")}>
          Abbrechen
        </Button>
      </div>
    </Card>
  );
}


import { useKeepWorkoutSessionAlive, useOpenWorkoutSession, useUpdateWorkoutSessionStatus } from "../../hooks/useWorkoutSession";
import { useAuthStore } from "../../stores/authStore";
import { Button, Callout } from "../ui";

const AUTO_COMPLETE_MINUTES = 30;

// Shown app-wide once the server noticed a session running for 2h ("Training noch aktiv?"). The
// server completes it by itself 30 min after asking, so ignoring this is a valid answer too.
export function ForgottenSessionPrompt() {
  const authenticated = useAuthStore((s) => s.status === "authenticated");
  const { data: session } = useOpenWorkoutSession();
  const keepAlive = useKeepWorkoutSessionAlive();
  const updateStatus = useUpdateWorkoutSessionStatus();

  if (!authenticated || !session?.stopPromptSentAt) return null;

  const deadline = new Date(new Date(session.stopPromptSentAt).getTime() + AUTO_COMPLETE_MINUTES * 60_000);
  const time = deadline.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="fixed inset-x-0 top-0 z-50 p-3">
      <Callout tone="warning" className="mx-auto max-w-xl bg-surface shadow-lg">
        <p className="font-medium text-text">Training noch aktiv?</p>
        <p className="mt-1">Dein Training läuft seit über 2 Stunden. Ohne Antwort schließe ich es um {time} Uhr automatisch ab.</p>
        {keepAlive.isError && <p className="mt-1 text-danger">Gerade nicht möglich – bist du online?</p>}
        <div className="mt-2 flex gap-2">
          <Button
            size="sm"
            variant="primary"
            disabled={updateStatus.isPending}
            onClick={() => updateStatus.mutate({ clientId: session.clientId, status: "COMPLETED" })}
          >
            Beenden
          </Button>
          <Button size="sm" disabled={keepAlive.isPending} onClick={() => keepAlive.mutate(session.clientId)}>
            Weiter trainieren
          </Button>
        </div>
      </Callout>
    </div>
  );
}

import { AppShell } from "../components/layout/AppShell";
import { PushReminderCard } from "../components/trainingPlan/PushReminderCard";
import { TRAINING_PHASE_LABELS, useTrainingPlan } from "../hooks/useTrainingPlan";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function TrainingPlanPage() {
  const { data: plan, isLoading } = useTrainingPlan();

  return (
    <AppShell>
      <h1 className="mb-4 text-xl font-semibold">Trainingsplan</h1>

      {isLoading ? (
        <p className="text-ink-500">Lädt…</p>
      ) : !plan ? (
        <p className="text-ink-500">Kein Plan gefunden.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-ink-800 bg-ink-900 p-4">
            <p className="text-sm text-ink-500">Aktuelle Phase</p>
            <p className="text-2xl font-semibold text-violet-400">
              {TRAINING_PHASE_LABELS[plan.currentPhase]}
            </p>
            <p className="mt-2 text-sm text-ink-400">
              Seit {formatDate(plan.phaseStartedOn)} · nächster Wechsel {formatDate(plan.nextRotationOn)}
            </p>
          </div>

          <PushReminderCard />

          <div>
            <h2 className="mb-2 text-sm font-medium text-ink-400">Verlauf</h2>
            {plan.history.length === 0 ? (
              <p className="text-sm text-ink-600">Noch kein Phasenwechsel.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {plan.history.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-lg border border-ink-800 bg-ink-900 px-3 py-2 text-sm"
                  >
                    <span className="text-ink-300">{TRAINING_PHASE_LABELS[entry.phase]}</span>
                    <span className="text-ink-500">
                      {formatDate(entry.startedOn)} – {entry.endedOn ? formatDate(entry.endedOn) : "…"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}

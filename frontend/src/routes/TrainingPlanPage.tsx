import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { TrainingPhase } from "@fitnesstracker/shared";
import { AppShell } from "../components/layout/AppShell";
import { PushReminderCard } from "../components/trainingPlan/PushReminderCard";
import { PlanExerciseList } from "../components/trainingPlan/PlanExerciseList";
import { PhaseTabs } from "../components/trainingPlan/PhaseTabs";
import { RecommendedSplitsSection } from "../components/trainingPlan/RecommendedSplitsSection";
import {
  TRAINING_PHASE_LABELS,
  usePauseTrainingPlan,
  useRestartPhase,
  useResumeTrainingPlan,
  useTrainingPlan,
} from "../hooks/useTrainingPlan";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function TrainingPlanPage() {
  const { data: plan, isLoading } = useTrainingPlan();
  const pausePlan = usePauseTrainingPlan();
  const resumePlan = useResumeTrainingPlan();
  const restartPhase = useRestartPhase();
  const [selectedPhase, setSelectedPhase] = useState<TrainingPhase | null>(null);

  // Default the phase tabs to whatever phase is currently active, once the plan has loaded —
  // but only the first time, so switching tabs to plan ahead isn't reset by a background refetch.
  useEffect(() => {
    if (plan && selectedPhase === null) {
      setSelectedPhase(plan.currentPhase);
    }
  }, [plan, selectedPhase]);

  return (
    <AppShell>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Trainingsplan</h1>
        <Link to="/plan/generate" className="text-xs text-violet-400 hover:underline">
          Generieren &amp; Exportieren
        </Link>
      </div>

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
              Seit {formatDate(plan.phaseStartedOn)} ·{" "}
              {plan.pausedAt
                ? `pausiert seit ${formatDate(plan.pausedAt)}`
                : plan.nextRotationOn
                  ? `nächster Wechsel ${formatDate(plan.nextRotationOn)}`
                  : null}
            </p>
            <div className="mt-3 flex gap-2">
              {plan.pausedAt ? (
                <button
                  onClick={() => resumePlan.mutate()}
                  disabled={resumePlan.isPending}
                  className="rounded-lg bg-violet-500 px-3 py-1.5 text-sm font-medium text-ink-950 hover:bg-violet-400"
                >
                  Fortsetzen
                </button>
              ) : (
                <button
                  onClick={() => pausePlan.mutate()}
                  disabled={pausePlan.isPending}
                  className="rounded-lg bg-ink-800 px-3 py-1.5 text-sm font-medium text-ink-200 hover:bg-ink-700"
                >
                  Pausieren
                </button>
              )}
              <button
                onClick={() => restartPhase.mutate()}
                disabled={restartPhase.isPending}
                className="rounded-lg bg-transparent px-3 py-1.5 text-sm font-medium text-ink-400 hover:text-ink-200"
              >
                Phase neu starten
              </button>
            </div>
          </div>

          <PushReminderCard />

          <div>
            {selectedPhase && <PhaseTabs selected={selectedPhase} onSelect={setSelectedPhase} />}
            {selectedPhase && <PlanExerciseList phase={selectedPhase} />}
          </div>

          <RecommendedSplitsSection />

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

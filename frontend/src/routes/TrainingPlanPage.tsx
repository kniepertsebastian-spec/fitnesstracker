import { useEffect, useState } from "react";
import type { TrainingPhase } from "@fitnesstracker/shared";
import { TRAINING_PHASES } from "@fitnesstracker/shared";
import { AppShell } from "../components/layout/AppShell";
import { PushReminderCard } from "../components/trainingPlan/PushReminderCard";
import { PlanExportImportCard } from "../components/trainingPlan/PlanExportImportCard";
import { AiPlanGeneratorCard } from "../components/trainingPlan/AiPlanGeneratorCard";
import { PlanExerciseList } from "../components/trainingPlan/PlanExerciseList";
import { RecommendedSplitsSection } from "../components/trainingPlan/RecommendedSplitsSection";
import { TRAINING_PHASE_LABELS, useTrainingPlan } from "../hooks/useTrainingPlan";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function TrainingPlanPage() {
  const { data: plan, isLoading } = useTrainingPlan();
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

          <PlanExportImportCard />

          <div>
            <div className="mb-2 flex gap-1 rounded-lg border border-ink-800 bg-ink-900 p-1">
              {TRAINING_PHASES.map((phase) => (
                <button
                  key={phase}
                  onClick={() => setSelectedPhase(phase)}
                  className={`flex-1 rounded-md py-1.5 text-sm font-medium ${
                    selectedPhase === phase
                      ? "bg-violet-500 text-ink-950"
                      : "text-ink-400 hover:text-ink-200"
                  }`}
                >
                  {TRAINING_PHASE_LABELS[phase]}
                </button>
              ))}
            </div>
            {selectedPhase && (
              <div className="mb-4">
                <AiPlanGeneratorCard phase={selectedPhase} />
              </div>
            )}
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

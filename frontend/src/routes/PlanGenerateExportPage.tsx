import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { TrainingPhase } from "@fitnesstracker/shared";
import { AppShell } from "../components/layout/AppShell";
import { AiPlanGeneratorCard } from "../components/trainingPlan/AiPlanGeneratorCard";
import { PlanExportImportCard } from "../components/trainingPlan/PlanExportImportCard";
import { PhaseTabs } from "../components/trainingPlan/PhaseTabs";
import { useTrainingPlan } from "../hooks/useTrainingPlan";

// Split out of TrainingPlanPage (/plan) — that page had grown overloaded with the manual
// exercise list, the AI generator, and export/import all stacked together. Generating and
// exporting/importing are occasional, deliberate actions (not something glanced at during a
// workout) so they live on their own page now, reachable from /plan.
export function PlanGenerateExportPage() {
  const { data: plan, isLoading } = useTrainingPlan();
  const [selectedPhase, setSelectedPhase] = useState<TrainingPhase | null>(null);

  useEffect(() => {
    if (plan && selectedPhase === null) {
      setSelectedPhase(plan.currentPhase);
    }
  }, [plan, selectedPhase]);

  return (
    <AppShell>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Plan generieren &amp; exportieren</h1>
        <Link to="/plan" className="text-xs text-violet-400 hover:underline">
          Zum Plan
        </Link>
      </div>

      {isLoading ? (
        <p className="text-ink-500">Lädt…</p>
      ) : !plan ? (
        <p className="text-ink-500">Kein Plan gefunden.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {selectedPhase && <PhaseTabs selected={selectedPhase} onSelect={setSelectedPhase} />}
          {selectedPhase && <AiPlanGeneratorCard phase={selectedPhase} />}

          <PlanExportImportCard />
        </div>
      )}
    </AppShell>
  );
}

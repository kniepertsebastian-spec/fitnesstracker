import { useEffect, useState } from "react";
import type { TrainingPhase } from "@fitnesstracker/shared";
import { AppShell } from "../components/layout/AppShell";
import { AiPlanGeneratorCard } from "../components/trainingPlan/AiPlanGeneratorCard";
import { PlanExportImportCard } from "../components/trainingPlan/PlanExportImportCard";
import { PhaseTabs } from "../components/trainingPlan/PhaseTabs";
import { FormAnalysisCard } from "../components/trainingPlan/FormAnalysisCard";
import { ButtonLink, Skeleton } from "../components/ui";
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
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-h1 text-text lg:text-h1-lg">Plan generieren &amp; exportieren</h1>
        <ButtonLink to="/plan" variant="ghost">
          Zum Plan
        </ButtonLink>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : !plan ? (
        <p className="text-text-subtle">Kein Plan gefunden.</p>
      ) : (
        <div className="flex flex-col gap-4 lg:max-w-2xl">
          {selectedPhase && <PhaseTabs selected={selectedPhase} onSelect={setSelectedPhase} />}
          {selectedPhase && <AiPlanGeneratorCard phase={selectedPhase} />}

          <FormAnalysisCard />

          <PlanExportImportCard />
        </div>
      )}
    </AppShell>
  );
}

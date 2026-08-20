import type { TrainingPlan, TrainingPlanPhaseHistory } from "@prisma/client";
import type { TrainingPlanDto } from "@fitnesstracker/shared";

export function toTrainingPlanDto(
  plan: TrainingPlan,
  nextRotationOn: Date,
  history: TrainingPlanPhaseHistory[],
): TrainingPlanDto {
  return {
    currentPhase: plan.currentPhase,
    phaseStartedOn: plan.phaseStartedOn.toISOString(),
    nextRotationOn: nextRotationOn.toISOString(),
    history: history.map((entry) => ({
      id: entry.id,
      phase: entry.phase,
      startedOn: entry.startedOn.toISOString(),
      endedOn: entry.endedOn ? entry.endedOn.toISOString() : null,
    })),
  };
}

import { useQuery } from "@tanstack/react-query";
import type { TrainingPhase } from "@fitnesstracker/shared";
import { getTrainingPlanRequest } from "../api/trainingPlan.api";

export const TRAINING_PHASE_LABELS: Record<TrainingPhase, string> = {
  AUFBAU: "Aufbau",
  MUSKELAUSDAUER: "Muskelausdauer",
  NEGATIV: "Negativ",
};

export function useTrainingPlan() {
  return useQuery({
    queryKey: ["training-plan"],
    queryFn: getTrainingPlanRequest,
  });
}

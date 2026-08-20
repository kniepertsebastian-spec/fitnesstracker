import { useQuery } from "@tanstack/react-query";
import { getTrainingPlanRequest } from "../api/trainingPlan.api";

export { TRAINING_PHASE_LABELS } from "@fitnesstracker/shared";

export function useTrainingPlan() {
  return useQuery({
    queryKey: ["training-plan"],
    queryFn: getTrainingPlanRequest,
  });
}

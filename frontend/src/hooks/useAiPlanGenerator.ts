import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { GeneratePlanRequest } from "@fitnesstracker/shared";
import { generatePlanRequest } from "../api/aiPlanGenerator.api";

export function useGeneratePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GeneratePlanRequest) => generatePlanRequest(input),
    onSuccess: (result, variables) => {
      if (result.status === "generated") {
        queryClient.invalidateQueries({ queryKey: ["plan-exercises", variables.phase] });
        queryClient.invalidateQueries({ queryKey: ["plan-exercises", "week-status", variables.phase] });
      }
    },
  });
}

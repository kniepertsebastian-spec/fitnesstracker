import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { PlanExportFormat } from "@fitnesstracker/shared";
import { exportPlanExercisesRequest, importPlanExercisesRequest } from "../api/planExercise.api";

export function useExportPlan() {
  return useMutation({
    mutationFn: async (format: PlanExportFormat) => {
      const blob = await exportPlanExercisesRequest(format);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `trainingsplan.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    },
  });
}

export function useImportPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, format }: { file: File; format: PlanExportFormat }) =>
      importPlanExercisesRequest(file, format),
    onSuccess: () => {
      // Import can touch entries in any of the three phases, so invalidate the whole
      // "plan-exercises" family rather than a single phase's query key.
      queryClient.invalidateQueries({ queryKey: ["plan-exercises"] });
    },
  });
}

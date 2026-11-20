import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { PlanExportFormat, TrainingPhase } from "@fitnesstracker/shared";
import {
  exportPlanExercisesRequest,
  importPlanExercisesRequest,
  previewPlanImportRequest,
  type PlanImportOptions,
} from "../api/planExercise.api";

// `phase` undefined = the whole plan.
export function useExportPlan() {
  return useMutation({
    mutationFn: async ({ format, phase }: { format: PlanExportFormat; phase?: TrainingPhase }) => {
      const blob = await exportPlanExercisesRequest(format, phase);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `trainingsplan${phase ? `-${phase.toLowerCase()}` : ""}.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    },
  });
}

// Reads a file and says what is in it — nothing is written.
export function usePreviewPlanImport() {
  return useMutation({
    mutationFn: ({ file, format }: { file: File; format: PlanExportFormat }) => previewPlanImportRequest(file, format),
  });
}

export function useImportPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, format, options }: { file: File; format: PlanExportFormat; options?: PlanImportOptions }) =>
      importPlanExercisesRequest(file, format, options),
    onSuccess: () => {
      // Import can touch entries in any phase, so invalidate the whole "plan-exercises" family
      // rather than a single phase's query key.
      queryClient.invalidateQueries({ queryKey: ["plan-exercises"] });
      queryClient.invalidateQueries({ queryKey: ["stretching"] });
    },
  });
}

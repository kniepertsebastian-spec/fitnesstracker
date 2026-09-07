import { useMutation } from "@tanstack/react-query";
import { analyzeFormRequest } from "../api/formAnalysis.api";

export function useFormAnalysis() {
  return useMutation({
    mutationFn: ({ exerciseName, video }: { exerciseName: string; video: File }) =>
      analyzeFormRequest(exerciseName, video),
  });
}

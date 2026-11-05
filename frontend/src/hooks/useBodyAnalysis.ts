import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { analyzeBodyImageRequest, listBodyAnalysesRequest, saveBodyAnalysisRequest, type BodyAnalysisDraft } from "../api/bodyAnalysis.api";

const KEY = ["body-analyses"];
export function useBodyAnalyses() {
  return useQuery({ queryKey: KEY, queryFn: () => listBodyAnalysesRequest().then((r) => r.items) });
}
export function useAnalyzeBodyImage() {
  return useMutation({ mutationFn: analyzeBodyImageRequest });
}
export function useSaveBodyAnalysis() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (draft: BodyAnalysisDraft) => saveBodyAnalysisRequest(draft),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: KEY });
      client.invalidateQueries({ queryKey: ["body-composition"] });
    },
  });
}

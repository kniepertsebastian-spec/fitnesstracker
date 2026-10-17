import { apiFetch, apiUpload } from "./client";

export interface BodyAnalysisMetric {
  key: string;
  label: string;
  value: number;
  unit: string;
  explanation: string;
  assessment: string;
  confidence: "high" | "medium" | "low";
}
export interface BodyAnalysisDraft {
  measuredAt: string;
  sourceName: string;
  ocrText: string;
  summary: string;
  metrics: BodyAnalysisMetric[];
}
export interface BodyAnalysisEntry extends BodyAnalysisDraft {
  id: string;
  createdAt: string;
}
export function analyzeBodyImageRequest(file: File) {
  const form = new FormData();
  form.append("image", file);
  return apiUpload<BodyAnalysisDraft>("/body-analyses/analyze", form);
}
export function listBodyAnalysesRequest() {
  return apiFetch<{ items: BodyAnalysisEntry[] }>("/body-analyses");
}
export function saveBodyAnalysisRequest(input: BodyAnalysisDraft) {
  return apiFetch<BodyAnalysisEntry>("/body-analyses", { method: "POST", body: input });
}

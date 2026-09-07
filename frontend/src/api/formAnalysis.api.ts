import type { FormAnalysisResult } from "@fitnesstracker/shared";
import { apiUpload } from "./client";

export function analyzeFormRequest(exerciseName: string, video: File) {
  const data = new FormData();
  // Fields must precede the stream so Fastify exposes them when request.file() resolves.
  data.append("exerciseName", exerciseName);
  data.append("video", video);
  return apiUpload<FormAnalysisResult>("/form-analysis", data);
}

import { z } from "zod";

export const formAnalysisImprovementSchema = z.object({
  title: z.string(),
  detail: z.string(),
  priority: z.enum(["high", "medium", "low"]),
  timestamp: z.string().nullable(),
});

export const formAnalysisResultSchema = z.object({
  exerciseName: z.string(),
  rating: z.number().int().min(1).max(10),
  summary: z.string(),
  strengths: z.array(z.string()),
  improvements: z.array(formAnalysisImprovementSchema),
  safetyNotes: z.array(z.string()),
});
export type FormAnalysisResult = z.infer<typeof formAnalysisResultSchema>;

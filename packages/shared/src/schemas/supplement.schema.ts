import { z } from "zod";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:MM erwartet");

export const supplementVerdictSchema = z.enum([
  "ESSENTIAL",
  "USEFUL",
  "SITUATIONAL",
  "NOT_RECOMMENDED",
]);
export type SupplementVerdict = z.infer<typeof supplementVerdictSchema>;

export const supplementEvidenceTierSchema = z.enum(["A", "B", "C", "D"]);
export type SupplementEvidenceTier = z.infer<typeof supplementEvidenceTierSchema>;

export const supplementAnalysisSchema = z.object({
  canonicalName: z.string().min(1),
  displayNameDe: z.string().min(1),
  verdict: supplementVerdictSchema,
  evidenceTier: supplementEvidenceTierSchema,
  goalFitScore: z.number().int().min(1).max(10),
  generalEvidenceSummary: z.string(),
  personalizedRecommendation: z.string(),
  recommendedDosage: z.string(),
  optimalTiming: z.string(),
  suggestedReminderTime: timeSchema,
  stackWarnings: z.array(z.string()),
  sideEffectsOrCautions: z.array(z.string()),
  cachedEvidenceUsed: z.boolean().default(false),
});
export type SupplementAnalysisDto = z.infer<typeof supplementAnalysisSchema>;

export const analyzeSupplementRequestSchema = z.object({
  name: z.string().trim().min(2).max(120),
  notesOrIngredients: z.string().trim().max(500).optional(),
  forceRefresh: z.boolean().optional(),
});
export type AnalyzeSupplementInput = z.infer<typeof analyzeSupplementRequestSchema>;

export const createSupplementSchema = z.object({
  name: z.string().min(1).max(100),
  reminderTime: timeSchema,
  // IANA name (e.g. "Europe/Berlin") — the browser's own timezone, captured at creation time so
  // the reminder fires at the right wall-clock hour regardless of where the server runs.
  timeZone: z.string().min(1),
  aiAnalysis: supplementAnalysisSchema.nullable().optional(),
});
export type CreateSupplementInput = z.infer<typeof createSupplementSchema>;

export const updateSupplementSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  reminderTime: timeSchema.optional(),
  timeZone: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
  aiAnalysis: supplementAnalysisSchema.nullable().optional(),
});
export type UpdateSupplementInput = z.infer<typeof updateSupplementSchema>;

export const supplementDtoSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  reminderTime: z.string(),
  timeZone: z.string(),
  enabled: z.boolean(),
  aiAnalysis: supplementAnalysisSchema.nullable(),
});
export type SupplementDto = z.infer<typeof supplementDtoSchema>;

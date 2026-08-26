import { z } from "zod";
import { trainingPhaseSchema } from "./trainingPlan.schema.js";
import { planExerciseDtoSchema } from "./planExercise.schema.js";

export const AI_PROVIDERS = ["GEMINI", "OPENAI", "GROQ", "OPENROUTER"] as const;
export const aiProviderSchema = z.enum(AI_PROVIDERS);
export type AiProvider = z.infer<typeof aiProviderSchema>;

// Never carries the decrypted key — only whether one is stored, so the settings UI can show
// "configured" state without the backend ever sending a secret back over the wire.
export const aiSettingsDtoSchema = z.object({
  provider: aiProviderSchema.nullable(),
  hasApiKey: z.boolean(),
  model: z.string().nullable(),
  // Whether the server has AI_SETTINGS_ENCRYPTION_KEY configured at all — lets the frontend show
  // "not available on this deployment" instead of a confusing save failure.
  configured: z.boolean(),
});
export type AiSettingsDto = z.infer<typeof aiSettingsDtoSchema>;

export const saveAiSettingsSchema = z.object({
  provider: aiProviderSchema,
  apiKey: z.string().min(1),
  model: z.string().min(1).optional(),
});
export type SaveAiSettingsInput = z.infer<typeof saveAiSettingsSchema>;

export const coldStartEquipmentSchema = z.enum(["homegym", "dumbbells", "fullgym"]);
export const coldStartExperienceSchema = z.enum(["beginner", "intermediate", "advanced"]);

export const coldStartInputSchema = z.object({
  frequencyPerWeek: z.number().int().min(1).max(7),
  equipment: coldStartEquipmentSchema,
  experience: coldStartExperienceSchema,
  limitations: z.string().max(500).optional(),
});
export type ColdStartInput = z.infer<typeof coldStartInputSchema>;

export const generatePlanRequestSchema = z.object({
  phase: trainingPhaseSchema,
  coldStart: coldStartInputSchema.optional(),
});
export type GeneratePlanRequest = z.infer<typeof generatePlanRequestSchema>;

// Discriminated union: the backend can't tell whether cold-start input is needed until it has
// checked the user's history, so a first call without `coldStart` may come back asking for it
// instead of a plan — the frontend then shows the 4-step modal and retries with it filled in.
export const generatePlanResponseSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("needs_cold_start") }),
  z.object({ status: z.literal("generated"), items: z.array(planExerciseDtoSchema) }),
]);
export type GeneratePlanResponse = z.infer<typeof generatePlanResponseSchema>;

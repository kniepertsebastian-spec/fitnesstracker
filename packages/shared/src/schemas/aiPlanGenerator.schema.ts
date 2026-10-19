import { z } from "zod";
import { trainingPhaseSchema } from "./trainingPlan.schema.js";

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

// Equipment tags as free-exercise-db names them ("e-z curl bar" is folded into "barbell", an
// untagged exercise into "other"). The questionnaire is an allow-list: every tag not chosen is
// excluded outright, before the model ever sees the catalog.
export const EQUIPMENT_TAGS = [
  "machine",
  "dumbbell",
  "barbell",
  "cable",
  "body only",
  "kettlebells",
  "bands",
  "medicine ball",
  "exercise ball",
  "foam roll",
  "other",
] as const;
export const equipmentTagSchema = z.enum(EQUIPMENT_TAGS);
export type EquipmentTag = z.infer<typeof equipmentTagSchema>;
export const DEFAULT_EQUIPMENT: EquipmentTag[] = ["machine", "dumbbell", "barbell", "cable", "body only"];

export const SPLIT_PREFERENCES = ["auto", "full_body", "upper_lower", "push_pull_legs", "bro_split"] as const;
export const splitPreferenceSchema = z.enum(SPLIT_PREFERENCES);
export type SplitPreference = z.infer<typeof splitPreferenceSchema>;
export const coldStartExperienceSchema = z.enum(["beginner", "intermediate", "advanced"]);
export const trainingGoalSchema = z.enum([
  "muscle_gain",
  "strength",
  "endurance",
  "fat_loss",
  "general_fitness",
]);

export const coldStartInputSchema = z.object({
  frequencyPerWeek: z.number().int().min(1).max(7),
  split: splitPreferenceSchema.default("auto"),
  equipment: z.array(equipmentTagSchema).min(1),
  experience: coldStartExperienceSchema,
  goal: trainingGoalSchema,
  sessionDurationMinutes: z.number().int().min(15).max(240),
  equipmentDetails: z.string().max(500).optional(),
  priorityMuscles: z.string().max(500).optional(),
  preferredExercises: z.string().max(500).optional(),
  avoidedExercises: z.string().max(500).optional(),
  limitations: z.string().max(500).optional(),
});
export type ColdStartInput = z.infer<typeof coldStartInputSchema>;
// What the client sends; `split` may be omitted and defaults to "auto".
export type ColdStartInputPayload = z.input<typeof coldStartInputSchema>;

export const generatePlanRequestSchema = z.object({
  phase: trainingPhaseSchema,
  coldStart: coldStartInputSchema.optional(),
  // Regenerates only this day of the existing draft (same questionnaire), keeping the others.
  day: z.string().min(1).optional(),
});
export type GeneratePlanRequest = z.input<typeof generatePlanRequestSchema>;

// One exercise of a generated plan before it is accepted — also the shape of the backup of the
// plan a draft replaced.
export const planDraftItemSchema = z.object({
  day: z.string().nullable(),
  exerciseId: z.string().uuid(),
  exerciseName: z.string(),
  equipment: z.string().nullable(),
  primaryMuscles: z.array(z.string()),
  targetSets: z.number().int().nullable(),
  targetReps: z.number().int().nullable(),
  repRangeMin: z.number().int().nullable(),
  repRangeMax: z.number().int().nullable(),
  targetRir: z.number().int().nullable(),
  restSeconds: z.number().int().nullable(),
  notes: z.string().nullable(),
  startWeightKg: z.number().nullable(),
  alternativeExerciseId: z.string().uuid().nullable(),
  alternativeExerciseName: z.string().nullable(),
  // Added by the server because the model returned too few valid exercises for the day.
  filledByServer: z.boolean(),
});
export type PlanDraftItemDto = z.infer<typeof planDraftItemSchema>;

export const planDraftDtoSchema = z.object({
  phase: trainingPhaseSchema,
  days: z.array(z.string()),
  items: z.array(planDraftItemSchema),
  rationale: z.string().nullable(),
  createdAt: z.string(),
});
export type PlanDraftDto = z.infer<typeof planDraftDtoSchema>;

export const planDraftStateDtoSchema = z.object({
  draft: planDraftDtoSchema.nullable(),
  // Whether the plan replaced by the last accepted draft can still be restored.
  hasBackup: z.boolean(),
});
export type PlanDraftStateDto = z.infer<typeof planDraftStateDtoSchema>;

export const planPhaseRequestSchema = z.object({ phase: trainingPhaseSchema });

// Discriminated union: the backend can't tell whether cold-start input is needed until it has
// checked the user's history, so a first call without `coldStart` may come back asking for it
// instead of a plan — the frontend then shows the 4-step modal and retries with it filled in.
export const generatePlanResponseSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("needs_cold_start") }),
  z.object({ status: z.literal("draft"), draft: planDraftDtoSchema }),
]);
export type GeneratePlanResponse = z.infer<typeof generatePlanResponseSchema>;

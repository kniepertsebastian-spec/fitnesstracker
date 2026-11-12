import { z } from "zod";
import { trainingPhaseSchema } from "./trainingPlan.schema.js";
// Muscle names exactly as free-exercise-db tags them (also what Exercise.primaryMuscles holds),
// so a focus pick can be matched against the catalog without any translation layer.
export const STRETCH_FOCUS_MUSCLES = [
    "neck",
    "shoulders",
    "chest",
    "biceps",
    "triceps",
    "forearms",
    "lats",
    "middle back",
    "lower back",
    "traps",
    "abdominals",
    "glutes",
    "abductors",
    "adductors",
    "quadriceps",
    "hamstrings",
    "calves",
];
export const stretchFocusMuscleSchema = z.enum(STRETCH_FOCUS_MUSCLES);
export const STRETCH_FOCUS_LABELS = {
    neck: "Nacken",
    shoulders: "Schultern",
    chest: "Brust",
    biceps: "Bizeps",
    triceps: "Trizeps",
    forearms: "Unterarme",
    lats: "Latissimus",
    "middle back": "Mittlerer Rücken",
    "lower back": "Unterer Rücken",
    traps: "Trapez",
    abdominals: "Bauch",
    glutes: "Gesäß",
    abductors: "Abduktoren",
    adductors: "Adduktoren",
    quadriceps: "Quadrizeps",
    hamstrings: "Beinbeuger",
    calves: "Waden",
};
export const stretchItemDtoSchema = z.object({
    exerciseId: z.string().uuid(),
    name: z.string(),
    description: z.string().nullable(),
    imageUrls: z.array(z.string()),
    primaryMuscles: z.array(z.string()),
    holdSeconds: z.number().int().positive(),
    sets: z.number().int().positive(),
});
export const stretchDayDtoSchema = z.object({
    dayLabel: z.string().nullable(),
    // Muscles the day's training exercises hit, most-trained first — what the stretches target.
    muscles: z.array(z.string()),
    // "ai" = saved result of the AI generator, "auto" = derived on the fly from the muscle mapping.
    source: z.enum(["ai", "auto"]),
    items: z.array(stretchItemDtoSchema),
});
export const stretchPlanDtoSchema = z.object({
    phase: trainingPhaseSchema,
    days: z.array(stretchDayDtoSchema),
    // False when the catalog has no stretching exercises yet (nothing imported) — the UI then
    // points at the exercise import instead of showing an empty plan.
    catalogAvailable: z.boolean(),
});
export const generateStretchPlanRequestSchema = z.object({
    phase: trainingPhaseSchema,
});
export const dailyStretchDtoSchema = z.object({
    focus: stretchFocusMuscleSchema.nullable(),
    items: z.array(stretchItemDtoSchema),
    catalogAvailable: z.boolean(),
});
//# sourceMappingURL=stretching.schema.js.map
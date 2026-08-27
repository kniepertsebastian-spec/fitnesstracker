import { z } from "zod";
import { trainingPhaseSchema } from "./trainingPlan.schema.js";

export const planExerciseDtoSchema = z.object({
  id: z.string().uuid(),
  phase: trainingPhaseSchema,
  exerciseId: z.string().uuid(),
  exerciseName: z.string(),
  targetSets: z.number().int().nullable(),
  targetReps: z.number().int().nullable(),
  order: z.number().int(),
  // Which split day (e.g. "Push (Brust, Schultern, Trizeps)") this entry belongs to — set by the
  // AI plan generator for a multi-day split, null for manually added entries.
  dayLabel: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PlanExerciseDto = z.infer<typeof planExerciseDtoSchema>;

export const createPlanExerciseSchema = z.object({
  phase: trainingPhaseSchema,
  exerciseId: z.string().uuid(),
  targetSets: z.number().int().positive().optional(),
  targetReps: z.number().int().positive().optional(),
});
export type CreatePlanExerciseInput = z.infer<typeof createPlanExerciseSchema>;

export const updatePlanExerciseSchema = z.object({
  targetSets: z.number().int().positive().nullable().optional(),
  targetReps: z.number().int().positive().nullable().optional(),
  order: z.number().int().optional(),
});
export type UpdatePlanExerciseInput = z.infer<typeof updatePlanExerciseSchema>;

// Portable plan formats for export/import — CSV/JSON/XML are the three most common
// spreadsheet/interchange formats, hand-rolled without a parser dependency since the row shape
// is small and fixed (see backend planExport.format.ts).
export const planExportFormatSchema = z.enum(["csv", "json", "xml"]);
export type PlanExportFormat = z.infer<typeof planExportFormatSchema>;

export const planImportResultSchema = z.object({
  created: z.number().int(),
  updated: z.number().int(),
  errors: z.array(z.string()),
});
export type PlanImportResult = z.infer<typeof planImportResultSchema>;

// A plan exercise plus whether it already has a WorkoutLog entry this week — lets the plan
// diary (CurrentPlanCard) show a row as already-locked after a reload without the frontend
// having to re-derive "this week" itself; that boundary is computed once, server-side.
export const planDiaryExerciseDtoSchema = planExerciseDtoSchema.extend({
  loggedThisWeek: z.boolean(),
});
export type PlanDiaryExerciseDto = z.infer<typeof planDiaryExerciseDtoSchema>;

// One split day's exercises plus whether it's been trained this week (Mon-Sun) — see
// planWeekStatus.service.ts for how "trained" is decided.
export const planDayStatusDtoSchema = z.object({
  dayLabel: z.string().nullable(),
  exercises: z.array(planDiaryExerciseDtoSchema),
  completed: z.boolean(),
});
export type PlanDayStatusDto = z.infer<typeof planDayStatusDtoSchema>;

export const weeklyPlanStatusDtoSchema = z.object({
  // In split sequence (day 1, day 2, ...), not DB insertion order.
  days: z.array(planDayStatusDtoSchema),
  // Index into `days` of the day to show as "today's workout" — the first not-yet-completed
  // day this week. Null once every day in the split has been trained this week.
  activeDayIndex: z.number().int().nullable(),
});
export type WeeklyPlanStatusDto = z.infer<typeof weeklyPlanStatusDtoSchema>;

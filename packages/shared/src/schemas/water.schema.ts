import { z } from "zod";

// Positive to add, negative to undo an accidental tap — zero would be a no-op worth rejecting.
export const addWaterSchema = z.object({
  amountMl: z.number().int().refine((v) => v !== 0, "amountMl must not be zero"),
});
export type AddWaterInput = z.infer<typeof addWaterSchema>;

export const setWaterTargetSchema = z.object({
  targetMl: z.number().int().positive().nullable(),
});
export type SetWaterTargetInput = z.infer<typeof setWaterTargetSchema>;

export const waterDayDtoSchema = z.object({
  date: z.string(),
  amountMl: z.number().int(),
});
export type WaterDayDto = z.infer<typeof waterDayDtoSchema>;

export const waterStatusDtoSchema = z.object({
  today: waterDayDtoSchema,
  targetMl: z.number().int(),
  // True targetMl came from Profile.waterTargetMlOverride rather than the weight-derived
  // suggestion or the no-profile fallback — lets the UI say so without guessing.
  isCustomTarget: z.boolean(),
  history: z.array(waterDayDtoSchema),
});
export type WaterStatusDto = z.infer<typeof waterStatusDtoSchema>;

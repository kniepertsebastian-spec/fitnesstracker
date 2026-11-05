import { z } from "zod";

export const createBodyCompositionEntrySchema = z.object({
  weightKg: z.number().positive().max(500),
  bodyFatPercent: z.number().min(0).max(100).optional(),
  muscleMassKg: z.number().positive().max(500).optional(),
  bodyWaterPercent: z.number().min(0).max(100).optional(),
  measuredAt: z.string().datetime().optional(),
});
export type CreateBodyCompositionEntryInput = z.infer<typeof createBodyCompositionEntrySchema>;

// Bulk import of weight (and body fat) measurements read from a health-app export. Every entry
// carries its own timestamp; entries already present at the same moment are skipped.
export const importBodyCompositionSchema = z.object({
  entries: z
    .array(
      z.object({
        measuredAt: z.string().datetime(),
        weightKg: z.number().positive().max(500),
        bodyFatPercent: z.number().min(0).max(100).optional(),
      }),
    )
    .min(1)
    .max(1000),
});
export type ImportBodyCompositionInput = z.infer<typeof importBodyCompositionSchema>;

export interface ImportBodyCompositionResult {
  imported: number;
  skipped: number;
}

export const updateBodyCompositionEntrySchema = createBodyCompositionEntrySchema.partial();
export type UpdateBodyCompositionEntryInput = z.infer<typeof updateBodyCompositionEntrySchema>;

export const bodyCompositionEntryDtoSchema = z.object({
  id: z.string().uuid(),
  measuredAt: z.string(),
  weightKg: z.number(),
  bodyFatPercent: z.number().nullable(),
  muscleMassKg: z.number().nullable(),
  bodyWaterPercent: z.number().nullable(),
});
export type BodyCompositionEntryDto = z.infer<typeof bodyCompositionEntryDtoSchema>;

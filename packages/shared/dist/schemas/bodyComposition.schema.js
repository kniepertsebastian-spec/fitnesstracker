import { z } from "zod";
import { scaleDetailsSchema } from "./scaleDetails.schema.js";
export const createBodyCompositionEntrySchema = z.object({
    weightKg: z.number().positive().max(500),
    bodyFatPercent: z.number().min(0).max(100).optional(),
    muscleMassKg: z.number().positive().max(500).optional(),
    bodyWaterPercent: z.number().min(0).max(100).optional(),
    measuredAt: z.string().datetime().optional(),
});
// Bulk import of weight (and body fat, muscle mass, body water) measurements read from a
// health-app or scale-app export. Every entry carries its own timestamp; entries already present
// at the same moment are skipped.
export const importBodyCompositionSchema = z.object({
    entries: z
        .array(z.object({
        measuredAt: z.string().datetime(),
        weightKg: z.number().positive().max(500),
        bodyFatPercent: z.number().min(0).max(100).optional(),
        muscleMassKg: z.number().positive().max(500).optional(),
        bodyWaterPercent: z.number().min(0).max(100).optional(),
    }))
        .min(1)
        .max(1000),
});
export const updateBodyCompositionEntrySchema = createBodyCompositionEntrySchema.partial();
export const bodyCompositionEntryDtoSchema = z.object({
    id: z.string().uuid(),
    measuredAt: z.string(),
    weightKg: z.number(),
    bodyFatPercent: z.number().nullable(),
    muscleMassKg: z.number().nullable(),
    bodyWaterPercent: z.number().nullable(),
    // Full scale report (all values and impedances) when the measurement came from one.
    scaleDetails: scaleDetailsSchema.nullable(),
});
//# sourceMappingURL=bodyComposition.schema.js.map
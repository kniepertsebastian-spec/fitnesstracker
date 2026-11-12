import { z } from "zod";
// Everything else a scale report states next to weight, body fat, muscle mass and water, plus the
// raw bioimpedance per body segment. Kept per measurement so the app can study how the scale's
// numbers come about and how much they jump (see scaleAnalysis.ts).
const impedanceOhm = z.number().positive().max(2000);
export const impedanceSetSchema = z.object({
    rightArm: impedanceOhm,
    leftArm: impedanceOhm,
    trunk: impedanceOhm,
    rightLeg: impedanceOhm,
    leftLeg: impedanceOhm,
});
export const scaleDetailsSchema = z.object({
    source: z.literal("fitdays-report"),
    fatMassKg: z.number().positive().max(500).optional(),
    fatFreeMassKg: z.number().positive().max(500).optional(),
    boneMassKg: z.number().positive().max(50).optional(),
    proteinKg: z.number().positive().max(200).optional(),
    waterKg: z.number().positive().max(300).optional(),
    skeletalMuscleKg: z.number().positive().max(300).optional(),
    subcutaneousFatPercent: z.number().min(0).max(100).optional(),
    visceralFat: z.number().min(0).max(60).optional(),
    basalMetabolicRateKcal: z.number().positive().max(6000).optional(),
    bodyAge: z.number().int().min(5).max(120).optional(),
    asmi: z.number().positive().max(40).optional(),
    waistHipRatio: z.number().positive().max(2).optional(),
    score: z.number().min(0).max(150).optional(),
    impedance: z
        .object({ khz20: impedanceSetSchema.optional(), khz100: impedanceSetSchema.optional() })
        .optional(),
});
export const saveScaleReportSchema = z.object({
    measuredAt: z.string().datetime(),
    weightKg: z.number().positive().max(500),
    bodyFatPercent: z.number().min(0).max(100),
    muscleMassKg: z.number().positive().max(500),
    bodyWaterPercent: z.number().min(0).max(100),
    details: scaleDetailsSchema,
});
//# sourceMappingURL=scaleDetails.schema.js.map
import { z } from "zod";
export declare const createBodyCompositionEntrySchema: z.ZodObject<{
    weightKg: z.ZodNumber;
    bodyFatPercent: z.ZodOptional<z.ZodNumber>;
    muscleMassKg: z.ZodOptional<z.ZodNumber>;
    bodyWaterPercent: z.ZodOptional<z.ZodNumber>;
    measuredAt: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type CreateBodyCompositionEntryInput = z.infer<typeof createBodyCompositionEntrySchema>;
export declare const importBodyCompositionSchema: z.ZodObject<{
    entries: z.ZodArray<z.ZodObject<{
        measuredAt: z.ZodString;
        weightKg: z.ZodNumber;
        bodyFatPercent: z.ZodOptional<z.ZodNumber>;
        muscleMassKg: z.ZodOptional<z.ZodNumber>;
        bodyWaterPercent: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ImportBodyCompositionInput = z.infer<typeof importBodyCompositionSchema>;
export interface ImportBodyCompositionResult {
    imported: number;
    skipped: number;
}
export declare const updateBodyCompositionEntrySchema: z.ZodObject<{
    weightKg: z.ZodOptional<z.ZodNumber>;
    bodyFatPercent: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    muscleMassKg: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    bodyWaterPercent: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    measuredAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export type UpdateBodyCompositionEntryInput = z.infer<typeof updateBodyCompositionEntrySchema>;
export declare const bodyCompositionEntryDtoSchema: z.ZodObject<{
    id: z.ZodString;
    measuredAt: z.ZodString;
    weightKg: z.ZodNumber;
    bodyFatPercent: z.ZodNullable<z.ZodNumber>;
    muscleMassKg: z.ZodNullable<z.ZodNumber>;
    bodyWaterPercent: z.ZodNullable<z.ZodNumber>;
    scaleDetails: z.ZodNullable<z.ZodObject<{
        source: z.ZodLiteral<"fitdays-report">;
        fatMassKg: z.ZodOptional<z.ZodNumber>;
        fatFreeMassKg: z.ZodOptional<z.ZodNumber>;
        boneMassKg: z.ZodOptional<z.ZodNumber>;
        proteinKg: z.ZodOptional<z.ZodNumber>;
        waterKg: z.ZodOptional<z.ZodNumber>;
        skeletalMuscleKg: z.ZodOptional<z.ZodNumber>;
        subcutaneousFatPercent: z.ZodOptional<z.ZodNumber>;
        visceralFat: z.ZodOptional<z.ZodNumber>;
        basalMetabolicRateKcal: z.ZodOptional<z.ZodNumber>;
        bodyAge: z.ZodOptional<z.ZodNumber>;
        asmi: z.ZodOptional<z.ZodNumber>;
        waistHipRatio: z.ZodOptional<z.ZodNumber>;
        score: z.ZodOptional<z.ZodNumber>;
        impedance: z.ZodOptional<z.ZodObject<{
            khz20: z.ZodOptional<z.ZodObject<{
                rightArm: z.ZodNumber;
                leftArm: z.ZodNumber;
                trunk: z.ZodNumber;
                rightLeg: z.ZodNumber;
                leftLeg: z.ZodNumber;
            }, z.core.$strip>>;
            khz100: z.ZodOptional<z.ZodObject<{
                rightArm: z.ZodNumber;
                leftArm: z.ZodNumber;
                trunk: z.ZodNumber;
                rightLeg: z.ZodNumber;
                leftLeg: z.ZodNumber;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type BodyCompositionEntryDto = z.infer<typeof bodyCompositionEntryDtoSchema>;

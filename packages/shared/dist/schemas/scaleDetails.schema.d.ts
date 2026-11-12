import { z } from "zod";
export declare const impedanceSetSchema: z.ZodObject<{
    rightArm: z.ZodNumber;
    leftArm: z.ZodNumber;
    trunk: z.ZodNumber;
    rightLeg: z.ZodNumber;
    leftLeg: z.ZodNumber;
}, z.core.$strip>;
export type ImpedanceSet = z.infer<typeof impedanceSetSchema>;
export declare const scaleDetailsSchema: z.ZodObject<{
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
}, z.core.$strip>;
export type ScaleDetails = z.infer<typeof scaleDetailsSchema>;
export interface ScaleReportDraft {
    measuredAt: string;
    weightKg: number;
    bodyFatPercent: number;
    muscleMassKg: number;
    bodyWaterPercent: number;
    heightCm: number | null;
    ageYears: number | null;
    details: ScaleDetails;
    checks: {
        key: string;
        label: string;
        ok: boolean;
    }[];
    uncertain: string[];
}
export declare const saveScaleReportSchema: z.ZodObject<{
    measuredAt: z.ZodString;
    weightKg: z.ZodNumber;
    bodyFatPercent: z.ZodNumber;
    muscleMassKg: z.ZodNumber;
    bodyWaterPercent: z.ZodNumber;
    details: z.ZodObject<{
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
    }, z.core.$strip>;
}, z.core.$strip>;
export type SaveScaleReportInput = z.infer<typeof saveScaleReportSchema>;

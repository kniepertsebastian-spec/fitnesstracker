import { z } from "zod";
export declare const supplementVerdictSchema: z.ZodEnum<{
    ESSENTIAL: "ESSENTIAL";
    USEFUL: "USEFUL";
    SITUATIONAL: "SITUATIONAL";
    NOT_RECOMMENDED: "NOT_RECOMMENDED";
}>;
export type SupplementVerdict = z.infer<typeof supplementVerdictSchema>;
export declare const supplementEvidenceTierSchema: z.ZodEnum<{
    A: "A";
    B: "B";
    C: "C";
    D: "D";
}>;
export type SupplementEvidenceTier = z.infer<typeof supplementEvidenceTierSchema>;
export declare const supplementAnalysisSchema: z.ZodObject<{
    canonicalName: z.ZodString;
    displayNameDe: z.ZodString;
    verdict: z.ZodEnum<{
        ESSENTIAL: "ESSENTIAL";
        USEFUL: "USEFUL";
        SITUATIONAL: "SITUATIONAL";
        NOT_RECOMMENDED: "NOT_RECOMMENDED";
    }>;
    evidenceTier: z.ZodEnum<{
        A: "A";
        B: "B";
        C: "C";
        D: "D";
    }>;
    goalFitScore: z.ZodNumber;
    generalEvidenceSummary: z.ZodString;
    personalizedRecommendation: z.ZodString;
    recommendedDosage: z.ZodString;
    optimalTiming: z.ZodString;
    suggestedReminderTime: z.ZodString;
    stackWarnings: z.ZodArray<z.ZodString>;
    sideEffectsOrCautions: z.ZodArray<z.ZodString>;
    cachedEvidenceUsed: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export type SupplementAnalysisDto = z.infer<typeof supplementAnalysisSchema>;
export declare const analyzeSupplementRequestSchema: z.ZodObject<{
    name: z.ZodString;
    notesOrIngredients: z.ZodOptional<z.ZodString>;
    forceRefresh: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type AnalyzeSupplementInput = z.infer<typeof analyzeSupplementRequestSchema>;
export declare const createSupplementSchema: z.ZodObject<{
    name: z.ZodString;
    reminderTime: z.ZodString;
    timeZone: z.ZodString;
    aiAnalysis: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        canonicalName: z.ZodString;
        displayNameDe: z.ZodString;
        verdict: z.ZodEnum<{
            ESSENTIAL: "ESSENTIAL";
            USEFUL: "USEFUL";
            SITUATIONAL: "SITUATIONAL";
            NOT_RECOMMENDED: "NOT_RECOMMENDED";
        }>;
        evidenceTier: z.ZodEnum<{
            A: "A";
            B: "B";
            C: "C";
            D: "D";
        }>;
        goalFitScore: z.ZodNumber;
        generalEvidenceSummary: z.ZodString;
        personalizedRecommendation: z.ZodString;
        recommendedDosage: z.ZodString;
        optimalTiming: z.ZodString;
        suggestedReminderTime: z.ZodString;
        stackWarnings: z.ZodArray<z.ZodString>;
        sideEffectsOrCautions: z.ZodArray<z.ZodString>;
        cachedEvidenceUsed: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type CreateSupplementInput = z.infer<typeof createSupplementSchema>;
export declare const updateSupplementSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    reminderTime: z.ZodOptional<z.ZodString>;
    timeZone: z.ZodOptional<z.ZodString>;
    enabled: z.ZodOptional<z.ZodBoolean>;
    aiAnalysis: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        canonicalName: z.ZodString;
        displayNameDe: z.ZodString;
        verdict: z.ZodEnum<{
            ESSENTIAL: "ESSENTIAL";
            USEFUL: "USEFUL";
            SITUATIONAL: "SITUATIONAL";
            NOT_RECOMMENDED: "NOT_RECOMMENDED";
        }>;
        evidenceTier: z.ZodEnum<{
            A: "A";
            B: "B";
            C: "C";
            D: "D";
        }>;
        goalFitScore: z.ZodNumber;
        generalEvidenceSummary: z.ZodString;
        personalizedRecommendation: z.ZodString;
        recommendedDosage: z.ZodString;
        optimalTiming: z.ZodString;
        suggestedReminderTime: z.ZodString;
        stackWarnings: z.ZodArray<z.ZodString>;
        sideEffectsOrCautions: z.ZodArray<z.ZodString>;
        cachedEvidenceUsed: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type UpdateSupplementInput = z.infer<typeof updateSupplementSchema>;
export declare const supplementDtoSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    reminderTime: z.ZodString;
    timeZone: z.ZodString;
    enabled: z.ZodBoolean;
    aiAnalysis: z.ZodNullable<z.ZodObject<{
        canonicalName: z.ZodString;
        displayNameDe: z.ZodString;
        verdict: z.ZodEnum<{
            ESSENTIAL: "ESSENTIAL";
            USEFUL: "USEFUL";
            SITUATIONAL: "SITUATIONAL";
            NOT_RECOMMENDED: "NOT_RECOMMENDED";
        }>;
        evidenceTier: z.ZodEnum<{
            A: "A";
            B: "B";
            C: "C";
            D: "D";
        }>;
        goalFitScore: z.ZodNumber;
        generalEvidenceSummary: z.ZodString;
        personalizedRecommendation: z.ZodString;
        recommendedDosage: z.ZodString;
        optimalTiming: z.ZodString;
        suggestedReminderTime: z.ZodString;
        stackWarnings: z.ZodArray<z.ZodString>;
        sideEffectsOrCautions: z.ZodArray<z.ZodString>;
        cachedEvidenceUsed: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type SupplementDto = z.infer<typeof supplementDtoSchema>;

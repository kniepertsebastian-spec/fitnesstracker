import { z } from "zod";
export declare const formAnalysisImprovementSchema: z.ZodObject<{
    title: z.ZodString;
    detail: z.ZodString;
    priority: z.ZodEnum<{
        high: "high";
        medium: "medium";
        low: "low";
    }>;
    timestamp: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export declare const formAnalysisResultSchema: z.ZodObject<{
    exerciseName: z.ZodString;
    rating: z.ZodNumber;
    summary: z.ZodString;
    strengths: z.ZodArray<z.ZodString>;
    improvements: z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        detail: z.ZodString;
        priority: z.ZodEnum<{
            high: "high";
            medium: "medium";
            low: "low";
        }>;
        timestamp: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
    safetyNotes: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type FormAnalysisResult = z.infer<typeof formAnalysisResultSchema>;

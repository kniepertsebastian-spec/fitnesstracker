import { z } from "zod";
export declare const weeklyMuscleVolumeDtoSchema: z.ZodObject<{
    weeks: z.ZodArray<z.ZodObject<{
        weekStart: z.ZodString;
        sets: z.ZodRecord<z.ZodString, z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type WeeklyMuscleVolumeDto = z.infer<typeof weeklyMuscleVolumeDtoSchema>;

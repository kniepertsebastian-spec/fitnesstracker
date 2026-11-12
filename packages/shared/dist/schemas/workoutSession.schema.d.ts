import { z } from "zod";
export declare const workoutSessionStatusSchema: z.ZodEnum<{
    ACTIVE: "ACTIVE";
    PAUSED: "PAUSED";
    COMPLETED: "COMPLETED";
    ABORTED: "ABORTED";
}>;
export type WorkoutSessionStatus = z.infer<typeof workoutSessionStatusSchema>;
export declare const createWorkoutSessionSchema: z.ZodObject<{
    clientId: z.ZodString;
}, z.core.$strip>;
export type CreateWorkoutSessionInput = z.infer<typeof createWorkoutSessionSchema>;
export declare const updateWorkoutSessionSchema: z.ZodObject<{
    status: z.ZodEnum<{
        ACTIVE: "ACTIVE";
        PAUSED: "PAUSED";
        COMPLETED: "COMPLETED";
        ABORTED: "ABORTED";
    }>;
}, z.core.$strip>;
export type UpdateWorkoutSessionInput = z.infer<typeof updateWorkoutSessionSchema>;
export declare const workoutSessionDtoSchema: z.ZodObject<{
    id: z.ZodString;
    clientId: z.ZodString;
    status: z.ZodEnum<{
        ACTIVE: "ACTIVE";
        PAUSED: "PAUSED";
        COMPLETED: "COMPLETED";
        ABORTED: "ABORTED";
    }>;
    startedAt: z.ZodString;
    endedAt: z.ZodNullable<z.ZodString>;
    stopPromptSentAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export type WorkoutSessionDto = z.infer<typeof workoutSessionDtoSchema>;

import { z } from "zod";
export declare const progressPhotoDtoSchema: z.ZodObject<{
    id: z.ZodString;
    takenAt: z.ZodString;
}, z.core.$strip>;
export type ProgressPhotoDto = z.infer<typeof progressPhotoDtoSchema>;

import { z } from "zod";

export const cardioMachineSchema = z.enum(["TREADMILL", "BIKE", "STEPPER", "STAIRMASTER"]);
export type CardioMachine = z.infer<typeof cardioMachineSchema>;

export const createCardioLogSchema = z.object({
  machine: cardioMachineSchema,
  level: z.number().int().positive().nullable().optional(),
  intensity: z.string().trim().min(1).max(50),
  durationMinutes: z.number().int().positive(),
});
export type CreateCardioLogInput = z.infer<typeof createCardioLogSchema>;

export const cardioLogDtoSchema = z.object({
  id: z.string().uuid(),
  machine: cardioMachineSchema,
  level: z.number().int().nullable(),
  intensity: z.string(),
  durationMinutes: z.number().int(),
  performedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CardioLogDto = z.infer<typeof cardioLogDtoSchema>;

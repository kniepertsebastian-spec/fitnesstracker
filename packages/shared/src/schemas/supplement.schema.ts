import { z } from "zod";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:MM erwartet");

export const createSupplementSchema = z.object({
  name: z.string().min(1).max(100),
  reminderTime: timeSchema,
  // IANA name (e.g. "Europe/Berlin") — the browser's own timezone, captured at creation time so
  // the reminder fires at the right wall-clock hour regardless of where the server runs.
  timeZone: z.string().min(1),
});
export type CreateSupplementInput = z.infer<typeof createSupplementSchema>;

export const updateSupplementSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  reminderTime: timeSchema.optional(),
  timeZone: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
});
export type UpdateSupplementInput = z.infer<typeof updateSupplementSchema>;

export const supplementDtoSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  reminderTime: z.string(),
  timeZone: z.string(),
  enabled: z.boolean(),
});
export type SupplementDto = z.infer<typeof supplementDtoSchema>;

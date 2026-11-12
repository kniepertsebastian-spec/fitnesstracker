import { z } from "zod";
export const dataSourceSchema = z.enum(["MANUAL", "IMPORT", "FITBIT"]);
export const DATA_SOURCE_LABELS = {
    MANUAL: "manuell eingetragen",
    IMPORT: "aus Export-Datei",
    FITBIT: "Fitbit (automatisch)",
};
export const cardioMachineSchema = z.enum(["TREADMILL", "BIKE", "STEPPER", "STAIRMASTER"]);
export const createCardioLogSchema = z.object({
    // F9: set by the offline queue so a retried create is idempotent (same clientId → same row).
    clientId: z.string().uuid().optional(),
    // When it was actually done — an entry queued offline syncs later than it happened.
    performedAt: z.string().datetime().optional(),
    machine: cardioMachineSchema,
    level: z.number().int().positive().nullable().optional(),
    intensity: z.string().trim().min(1).max(50),
    durationMinutes: z.number().int().positive(),
    distanceKm: z.number().positive().max(999).nullable().optional(),
});
export const cardioLogDtoSchema = z.object({
    id: z.string().uuid(),
    clientId: z.string().nullable(),
    machine: cardioMachineSchema,
    level: z.number().int().nullable(),
    intensity: z.string(),
    durationMinutes: z.number().int(),
    distanceKm: z.number().nullable(),
    source: dataSourceSchema,
    performedAt: z.string().datetime(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});
//# sourceMappingURL=cardioLog.schema.js.map
import { z } from "zod";

// A reference reading (DEXA scan or similar) for one day. The estimate on that day and the offset
// are computed by the server from the nearest tape measurement.
export const createBodyFatCalibrationSchema = z.object({
  measuredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum als JJJJ-MM-TT angeben"),
  referencePercent: z.number().min(2).max(70),
});
export type CreateBodyFatCalibrationInput = z.infer<typeof createBodyFatCalibrationSchema>;

export const bodyFatCalibrationDtoSchema = z.object({
  id: z.string().uuid(),
  measuredOn: z.string(),
  referencePercent: z.number(),
  estimatePercent: z.number(),
  /** Reference minus estimate on that day; added to later estimates. */
  offsetPercent: z.number(),
});
export type BodyFatCalibrationDto = z.infer<typeof bodyFatCalibrationDtoSchema>;

/** The shift applied to a formula range: `low` and `high` move by the offset, clamped to 0–100. */
export function applyCalibrationOffset(range: { low: number; high: number }, offsetPercent: number) {
  const shift = (value: number) => Math.round(Math.min(Math.max(value + offsetPercent, 0), 100) * 10) / 10;
  return { low: shift(range.low), high: shift(range.high) };
}

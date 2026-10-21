import { z } from "zod";

// Sets per primary muscle for each Monday–Sunday week (UTC), oldest week first. `weekStart` is the
// Monday as YYYY-MM-DD; muscles with no sets in a week are absent from `sets`.
export const weeklyMuscleVolumeDtoSchema = z.object({
  weeks: z.array(
    z.object({
      weekStart: z.string(),
      sets: z.record(z.string(), z.number().int().nonnegative()),
    }),
  ),
});
export type WeeklyMuscleVolumeDto = z.infer<typeof weeklyMuscleVolumeDtoSchema>;

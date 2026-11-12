import type { BodyCompositionEntry } from "@prisma/client";
import { scaleDetailsSchema, type BodyCompositionEntryDto } from "@fitnesstracker/shared";

export function toBodyCompositionEntryDto(entry: BodyCompositionEntry): BodyCompositionEntryDto {
  // Stored JSON is validated again on the way out: a row written by an older version, or edited by
  // hand, must not break the list.
  const details = scaleDetailsSchema.safeParse(entry.scaleDetails);
  return {
    id: entry.id,
    measuredAt: entry.measuredAt.toISOString(),
    weightKg: Number(entry.weightKg),
    bodyFatPercent: entry.bodyFatPercent === null ? null : Number(entry.bodyFatPercent),
    muscleMassKg: entry.muscleMassKg === null ? null : Number(entry.muscleMassKg),
    bodyWaterPercent: entry.bodyWaterPercent === null ? null : Number(entry.bodyWaterPercent),
    waistCm: entry.waistCm === null ? null : Number(entry.waistCm),
    neckCm: entry.neckCm === null ? null : Number(entry.neckCm),
    hipCm: entry.hipCm === null ? null : Number(entry.hipCm),
    scaleDetails: details.success ? details.data : null,
  };
}

import type { BodyCompositionEntry } from "@prisma/client";
import type { BodyCompositionEntryDto } from "@fitnesstracker/shared";

export function toBodyCompositionEntryDto(entry: BodyCompositionEntry): BodyCompositionEntryDto {
  return {
    id: entry.id,
    measuredAt: entry.measuredAt.toISOString(),
    weightKg: Number(entry.weightKg),
    bodyFatPercent: entry.bodyFatPercent === null ? null : Number(entry.bodyFatPercent),
    muscleMassKg: entry.muscleMassKg === null ? null : Number(entry.muscleMassKg),
    bodyWaterPercent: entry.bodyWaterPercent === null ? null : Number(entry.bodyWaterPercent),
  };
}

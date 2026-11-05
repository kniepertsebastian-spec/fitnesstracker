import type { BodyCompositionEntryDto, ScaleReading } from "@fitnesstracker/shared";

export function entriesToReadings(entries: BodyCompositionEntryDto[]): ScaleReading[] {
  return entries.map((e) => ({
    measuredAt: e.measuredAt,
    weightKg: e.weightKg,
    bodyFatPercent: e.bodyFatPercent,
    muscleMassKg: e.muscleMassKg,
    bodyWaterPercent: e.bodyWaterPercent,
    details: e.scaleDetails,
  }));
}

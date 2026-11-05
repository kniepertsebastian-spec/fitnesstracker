import type { Supplement } from "@prisma/client";
import { supplementAnalysisSchema, type SupplementDto } from "@fitnesstracker/shared";

export function toSupplementDto(supplement: Supplement): SupplementDto {
  const parsedAnalysis = supplement.aiAnalysis
    ? supplementAnalysisSchema.safeParse(supplement.aiAnalysis)
    : null;

  return {
    id: supplement.id,
    name: supplement.name,
    reminderTime: supplement.reminderTime,
    timeZone: supplement.timeZone,
    enabled: supplement.enabled,
    aiAnalysis: parsedAnalysis?.success ? parsedAnalysis.data : null,
  };
}

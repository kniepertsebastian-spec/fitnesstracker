import type { Supplement } from "@prisma/client";
import type { SupplementDto } from "@fitnesstracker/shared";

export function toSupplementDto(supplement: Supplement): SupplementDto {
  return {
    id: supplement.id,
    name: supplement.name,
    reminderTime: supplement.reminderTime,
    timeZone: supplement.timeZone,
    enabled: supplement.enabled,
  };
}

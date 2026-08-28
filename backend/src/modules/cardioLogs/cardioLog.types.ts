import type { CardioLog } from "@prisma/client";
import type { CardioLogDto } from "@fitnesstracker/shared";

export function toCardioLogDto(log: CardioLog): CardioLogDto {
  return {
    id: log.id,
    machine: log.machine,
    level: log.level,
    intensity: log.intensity,
    durationMinutes: log.durationMinutes,
    performedAt: log.performedAt.toISOString(),
    createdAt: log.createdAt.toISOString(),
    updatedAt: log.updatedAt.toISOString(),
  };
}

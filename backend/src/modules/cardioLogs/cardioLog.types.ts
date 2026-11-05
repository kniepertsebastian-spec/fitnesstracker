import type { CardioLog } from "@prisma/client";
import type { CardioLogDto } from "@fitnesstracker/shared";

export function toCardioLogDto(log: CardioLog): CardioLogDto {
  return {
    id: log.id,
    clientId: log.clientId,
    machine: log.machine,
    level: log.level,
    intensity: log.intensity,
    durationMinutes: log.durationMinutes,
    distanceKm: log.distanceKm === null ? null : Number(log.distanceKm),
    source: log.source,
    performedAt: log.performedAt.toISOString(),
    createdAt: log.createdAt.toISOString(),
    updatedAt: log.updatedAt.toISOString(),
  };
}

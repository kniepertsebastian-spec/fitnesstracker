import type { WorkoutSession } from "@prisma/client";
import type { WorkoutSessionDto } from "@fitnesstracker/shared";

export function toWorkoutSessionDto(session: WorkoutSession): WorkoutSessionDto {
  return {
    id: session.id,
    clientId: session.clientId,
    status: session.status,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt ? session.endedAt.toISOString() : null,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

import type { PrismaClient } from "@prisma/client";
import type { CreateWorkoutSessionInput, WorkoutSessionStatus } from "@fitnesstracker/shared";
import { NotFoundError } from "../../errors/httpErrors.js";

const TERMINAL_STATUSES: WorkoutSessionStatus[] = ["COMPLETED", "ABORTED"];

// At most one session is ever "open" (ACTIVE or PAUSED) per user in normal use — the frontend
// only offers "Start" when it has none locally. `orderBy updatedAt desc` is just a safety net in
// case that invariant is ever violated (e.g. two devices racing), so the client always gets a
// single, most-recently-touched session back rather than an ambiguous list.
export function getOpenWorkoutSession(prisma: PrismaClient, userId: string) {
  return prisma.workoutSession.findFirst({
    where: { userId, status: { in: ["ACTIVE", "PAUSED"] } },
    orderBy: { updatedAt: "desc" },
  });
}

// Idempotent by clientId, same pattern as createWorkoutLog: a retried "Start" (flaky connection,
// or the offline sync queue replaying) returns the existing session instead of creating a
// second one.
export function createWorkoutSession(
  prisma: PrismaClient,
  userId: string,
  input: CreateWorkoutSessionInput,
) {
  return prisma.workoutSession.upsert({
    where: { clientId: input.clientId },
    update: {},
    create: { clientId: input.clientId, userId },
  });
}

async function findOwnedWorkoutSession(prisma: PrismaClient, userId: string, idOrClientId: string) {
  const existing = await prisma.workoutSession.findFirst({
    where: { userId, OR: [{ id: idOrClientId }, { clientId: idOrClientId }] },
  });
  if (!existing) {
    throw new NotFoundError("Workout session not found");
  }
  return existing;
}

export async function updateWorkoutSessionStatus(
  prisma: PrismaClient,
  userId: string,
  idOrClientId: string,
  status: WorkoutSessionStatus,
) {
  const existing = await findOwnedWorkoutSession(prisma, userId, idOrClientId);
  return prisma.workoutSession.update({
    where: { id: existing.id },
    data: {
      status,
      endedAt: TERMINAL_STATUSES.includes(status) ? new Date() : existing.endedAt,
    },
  });
}

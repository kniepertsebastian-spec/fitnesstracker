import type { PrismaClient } from "@prisma/client";
import type { CreateCardioLogInput } from "@fitnesstracker/shared";
import { ConflictError, NotFoundError } from "../../errors/httpErrors.js";
import { getUserTimeZone, localDayStart, localWeekStart } from "../../lib/userTime.js";

// "This week" and "today" start at the user's local Monday / midnight (same boundaries as the
// plan-week status).
export async function listWeekCardioLogs(prisma: PrismaClient, userId: string) {
  const weekStart = localWeekStart(new Date(), await getUserTimeZone(prisma, userId));
  return prisma.cardioLog.findMany({
    where: { userId, deletedAt: null, performedAt: { gte: weekStart } },
    orderBy: { performedAt: "desc" },
  });
}

export async function listTodayCardioLogs(prisma: PrismaClient, userId: string) {
  const dayStart = localDayStart(new Date(), await getUserTimeZone(prisma, userId));
  return prisma.cardioLog.findMany({
    where: { userId, deletedAt: null, performedAt: { gte: dayStart } },
    orderBy: { createdAt: "asc" },
  });
}

// Idempotent per clientId (F9 offline queue): a create that is retried after its response got
// lost returns the row the first attempt already wrote instead of logging the session twice. A
// clientId owned by another user is treated as a conflict, never returned.
export async function createCardioLog(prisma: PrismaClient, userId: string, input: CreateCardioLogInput) {
  if (input.clientId) {
    const existing = await prisma.cardioLog.findUnique({ where: { clientId: input.clientId } });
    if (existing) {
      if (existing.userId !== userId) throw new ConflictError("clientId already in use");
      return existing;
    }
  }
  return prisma.cardioLog.create({
    data: {
      userId,
      clientId: input.clientId ?? null,
      machine: input.machine,
      level: input.level ?? null,
      intensity: input.intensity,
      durationMinutes: input.durationMinutes,
      distanceKm: input.distanceKm ?? null,
      ...(input.performedAt ? { performedAt: new Date(input.performedAt) } : {}),
    },
  });
}

export async function deleteCardioLog(prisma: PrismaClient, userId: string, id: string) {
  const existing = await prisma.cardioLog.findFirst({ where: { id, userId, deletedAt: null } });
  if (!existing) {
    throw new NotFoundError("Cardio log not found");
  }
  await prisma.cardioLog.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
}

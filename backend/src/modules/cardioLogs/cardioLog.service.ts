import type { PrismaClient } from "@prisma/client";
import type { CreateCardioLogInput } from "@fitnesstracker/shared";
import { NotFoundError } from "../../errors/httpErrors.js";

// Same UTC-calendar-day convention as water/daily-challenge — the dashboard cardio card only
// ever shows "today", no history view to page through yet.
function todayUtcDate(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function listTodayCardioLogs(prisma: PrismaClient, userId: string) {
  return prisma.cardioLog.findMany({
    where: { userId, deletedAt: null, performedAt: { gte: todayUtcDate() } },
    orderBy: { createdAt: "asc" },
  });
}

export function createCardioLog(prisma: PrismaClient, userId: string, input: CreateCardioLogInput) {
  return prisma.cardioLog.create({
    data: {
      userId,
      machine: input.machine,
      level: input.level ?? null,
      intensity: input.intensity,
      durationMinutes: input.durationMinutes,
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

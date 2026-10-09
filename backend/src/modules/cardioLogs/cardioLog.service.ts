import type { PrismaClient } from "@prisma/client";
import type { CreateCardioLogInput } from "@fitnesstracker/shared";
import { ConflictError, NotFoundError } from "../../errors/httpErrors.js";

// Same UTC-calendar-day convention as daily-challenge — the dashboard cardio card only
// ever shows "today", no history view to page through yet.
function todayUtcDate(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

// Monday 00:00 UTC of the week containing `date` (same week boundary as the plan-week status).
export function weekStartUtc(date: Date = new Date()): Date {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day;
}

export function listWeekCardioLogs(prisma: PrismaClient, userId: string) {
  return prisma.cardioLog.findMany({
    where: { userId, deletedAt: null, performedAt: { gte: weekStartUtc() } },
    orderBy: { performedAt: "desc" },
  });
}

export function listTodayCardioLogs(prisma: PrismaClient, userId: string) {
  return prisma.cardioLog.findMany({
    where: { userId, deletedAt: null, performedAt: { gte: todayUtcDate() } },
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

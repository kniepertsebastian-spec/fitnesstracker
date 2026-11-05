import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  CreateBodyCompositionEntryInput,
  ImportBodyCompositionInput,
  ImportBodyCompositionResult,
  SaveScaleReportInput,
  UpdateBodyCompositionEntryInput,
} from "@fitnesstracker/shared";
import { NotFoundError } from "../../errors/httpErrors.js";

const HISTORY_LIMIT = 60;

export function listEntries(prisma: PrismaClient, userId: string) {
  return prisma.bodyCompositionEntry.findMany({
    where: { userId },
    orderBy: { measuredAt: "desc" },
    take: HISTORY_LIMIT,
  });
}

export function createEntry(prisma: PrismaClient, userId: string, input: CreateBodyCompositionEntryInput) {
  return prisma.bodyCompositionEntry.create({
    data: {
      userId,
      weightKg: input.weightKg,
      bodyFatPercent: input.bodyFatPercent,
      muscleMassKg: input.muscleMassKg,
      bodyWaterPercent: input.bodyWaterPercent,
      measuredAt: input.measuredAt ? new Date(input.measuredAt) : undefined,
    },
  });
}

// Skips measurements that exist already at the same moment (a re-import of the same file is a
// no-op) and repeats within the payload itself. Values are rounded to the column precision
// (weight and muscle mass: 2 decimals, percentages: 1).
export async function importEntries(
  prisma: PrismaClient,
  userId: string,
  input: ImportBodyCompositionInput,
): Promise<ImportBodyCompositionResult> {
  const times = input.entries.map((e) => new Date(e.measuredAt).getTime());
  const existing = await prisma.bodyCompositionEntry.findMany({
    where: { userId, measuredAt: { gte: new Date(Math.min(...times)), lte: new Date(Math.max(...times)) } },
    select: { measuredAt: true },
  });
  const seen = new Set(existing.map((e) => e.measuredAt.getTime()));
  const fresh = input.entries.filter((entry) => {
    const time = new Date(entry.measuredAt).getTime();
    if (seen.has(time)) return false;
    seen.add(time);
    return true;
  });
  if (fresh.length > 0) {
    await prisma.bodyCompositionEntry.createMany({
      data: fresh.map((entry) => ({
        userId,
        measuredAt: new Date(entry.measuredAt),
        weightKg: Math.round(entry.weightKg * 100) / 100,
        bodyFatPercent: entry.bodyFatPercent === undefined ? undefined : Math.round(entry.bodyFatPercent * 10) / 10,
        muscleMassKg: entry.muscleMassKg === undefined ? undefined : Math.round(entry.muscleMassKg * 100) / 100,
        bodyWaterPercent: entry.bodyWaterPercent === undefined ? undefined : Math.round(entry.bodyWaterPercent * 10) / 10,
      })),
    });
  }
  return { imported: fresh.length, skipped: input.entries.length - fresh.length };
}

// A scale report read from a screenshot becomes one measurement carrying the full details. Saving
// the same report twice (same test time) updates that measurement instead of adding a second one.
export async function saveScaleReport(prisma: PrismaClient, userId: string, input: SaveScaleReportInput) {
  const measuredAt = new Date(input.measuredAt);
  const data = {
    weightKg: Math.round(input.weightKg * 100) / 100,
    bodyFatPercent: Math.round(input.bodyFatPercent * 10) / 10,
    muscleMassKg: Math.round(input.muscleMassKg * 100) / 100,
    bodyWaterPercent: Math.round(input.bodyWaterPercent * 10) / 10,
    scaleDetails: input.details as Prisma.InputJsonValue,
  };
  const existing = await prisma.bodyCompositionEntry.findFirst({ where: { userId, measuredAt }, select: { id: true } });
  return existing
    ? prisma.bodyCompositionEntry.update({ where: { id: existing.id }, data })
    : prisma.bodyCompositionEntry.create({ data: { userId, measuredAt, ...data } });
}

export async function updateEntry(
  prisma: PrismaClient,
  userId: string,
  id: string,
  input: UpdateBodyCompositionEntryInput,
) {
  const existing = await prisma.bodyCompositionEntry.findFirst({ where: { id, userId } });
  if (!existing) {
    throw new NotFoundError("Body composition entry not found");
  }
  return prisma.bodyCompositionEntry.update({
    where: { id },
    data: {
      weightKg: input.weightKg,
      bodyFatPercent: input.bodyFatPercent,
      muscleMassKg: input.muscleMassKg,
      bodyWaterPercent: input.bodyWaterPercent,
      measuredAt: input.measuredAt ? new Date(input.measuredAt) : undefined,
    },
  });
}

export async function deleteEntry(prisma: PrismaClient, userId: string, id: string) {
  const existing = await prisma.bodyCompositionEntry.findFirst({ where: { id, userId } });
  if (!existing) {
    throw new NotFoundError("Body composition entry not found");
  }
  await prisma.bodyCompositionEntry.delete({ where: { id } });
}

// Used by goal.service.ts to derive progress for BODYWEIGHT goals — the most recent weigh-in
// is the natural "current value" for a bodyweight target.
export async function getLatestWeightKg(prisma: PrismaClient, userId: string): Promise<number | null> {
  const latest = await prisma.bodyCompositionEntry.findFirst({
    where: { userId },
    orderBy: { measuredAt: "desc" },
  });
  return latest ? Number(latest.weightKg) : null;
}

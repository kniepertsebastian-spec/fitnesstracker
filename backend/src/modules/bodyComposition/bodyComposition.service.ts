import type { PrismaClient } from "@prisma/client";
import type {
  CreateBodyCompositionEntryInput,
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

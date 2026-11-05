import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { HealthSyncStatusDto } from "@fitnesstracker/shared";
import type { ExtractedActivity } from "./healthSync.payload.js";

const TOKEN_PREFIX = "fth_";
const UPDATE_BATCH = 200;

export function generateSyncToken(): string {
  return TOKEN_PREFIX + randomBytes(32).toString("base64url");
}

// Only this hash is stored. The token is 256 random bits, so a plain SHA-256 is enough (there is no
// password to stretch) and lets the webhook find the row with one indexed lookup.
export function hashSyncToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Replaces any earlier token: the previous one stops working at once.
export async function createSyncToken(prisma: PrismaClient, userId: string): Promise<string> {
  const token = generateSyncToken();
  const tokenHash = hashSyncToken(token);
  await prisma.healthSyncToken.upsert({
    where: { userId },
    create: { userId, tokenHash },
    update: { tokenHash, createdAt: new Date(), lastUsedAt: null, lastSequence: null },
  });
  return token;
}

export async function revokeSyncToken(prisma: PrismaClient, userId: string): Promise<void> {
  await prisma.healthSyncToken.deleteMany({ where: { userId } });
}

export async function findSyncToken(prisma: PrismaClient, token: string) {
  if (!token.startsWith(TOKEN_PREFIX) || token.length > 200) return null;
  return prisma.healthSyncToken.findUnique({
    where: { tokenHash: hashSyncToken(token) },
    select: { id: true, userId: true },
  });
}

export async function getSyncStatus(prisma: PrismaClient, userId: string): Promise<HealthSyncStatusDto> {
  const [token, days, rides] = await Promise.all([
    prisma.healthSyncToken.findUnique({ where: { userId }, select: { createdAt: true, lastUsedAt: true } }),
    prisma.dailyActivity.aggregate({
      where: { userId },
      _count: { _all: true },
      _min: { date: true },
      _max: { date: true },
    }),
    prisma.cyclingSession.count({ where: { userId } }),
  ]);
  return {
    connected: token !== null,
    tokenCreatedAt: token?.createdAt.toISOString() ?? null,
    lastUsedAt: token?.lastUsedAt?.toISOString() ?? null,
    daysStored: days._count._all,
    firstDay: days._min.date?.toISOString().slice(0, 10) ?? null,
    lastDay: days._max.date?.toISOString().slice(0, 10) ?? null,
    ridesStored: rides,
  };
}

export async function markTokenUsed(prisma: PrismaClient, tokenId: string, sequence: number | null): Promise<void> {
  await prisma.healthSyncToken.update({
    where: { id: tokenId },
    data: { lastUsedAt: new Date(), ...(sequence !== null ? { lastSequence: sequence } : {}) },
  });
}

const dayDate = (date: string) => new Date(`${date}T00:00:00.000Z`);

// Idempotent: days are stored by (user, local day), rides by Health Connect record id, so a payload
// that arrives twice or out of order changes nothing the second time. A day's step count only moves
// when the payload is not older than the one that wrote it (today's figure is a running total).
export async function ingestActivity(
  prisma: PrismaClient,
  userId: string,
  activity: ExtractedActivity,
): Promise<{ days: number; rides: number }> {
  let daysWritten = 0;

  if (activity.days.length > 0) {
    const existing = await prisma.dailyActivity.findMany({
      where: { userId, date: { in: activity.days.map((d) => dayDate(d.date)) } },
      select: { date: true, sequence: true },
    });
    const stored = new Map(existing.map((e) => [e.date.toISOString().slice(0, 10), e.sequence]));

    const fresh = activity.days.filter((d) => !stored.has(d.date));
    const toUpdate = activity.days.filter((d) => {
      if (!stored.has(d.date)) return false;
      const storedSequence = stored.get(d.date);
      return storedSequence === null || storedSequence === undefined || activity.sequence === null || activity.sequence >= storedSequence;
    });

    if (fresh.length > 0) {
      await prisma.dailyActivity.createMany({
        data: fresh.map((d) => ({
          userId,
          date: dayDate(d.date),
          steps: d.steps,
          distanceMeters: d.distanceMeters,
          sequence: activity.sequence,
        })),
        skipDuplicates: true,
      });
    }
    for (let i = 0; i < toUpdate.length; i += UPDATE_BATCH) {
      await prisma.$transaction(
        toUpdate.slice(i, i + UPDATE_BATCH).map((d) =>
          prisma.dailyActivity.update({
            where: { userId_date: { userId, date: dayDate(d.date) } },
            data: { steps: d.steps, distanceMeters: d.distanceMeters, sequence: activity.sequence },
          }),
        ),
      );
    }
    daysWritten = fresh.length + toUpdate.length;
  }

  for (let i = 0; i < activity.rides.length; i += UPDATE_BATCH) {
    await prisma.$transaction(
      activity.rides.slice(i, i + UPDATE_BATCH).map((ride) =>
        prisma.cyclingSession.upsert({
          where: { userId_externalId: { userId, externalId: ride.externalId } },
          create: {
            userId,
            externalId: ride.externalId,
            startedAt: ride.startedAt,
            endedAt: ride.endedAt,
            durationSeconds: ride.durationSeconds,
            distanceMeters: ride.distanceMeters,
            title: ride.title,
          },
          // A later payload may carry the distance that an earlier one lacked, never the reverse.
          update: {
            startedAt: ride.startedAt,
            endedAt: ride.endedAt,
            durationSeconds: ride.durationSeconds,
            title: ride.title,
            ...(ride.distanceMeters !== null ? { distanceMeters: ride.distanceMeters } : {}),
          },
        }),
      ),
    );
  }

  return { days: daysWritten, rides: activity.rides.length };
}

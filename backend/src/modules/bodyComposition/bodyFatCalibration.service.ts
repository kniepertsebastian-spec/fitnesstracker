import type { BodyFatCalibration, PrismaClient } from "@prisma/client";
import { bodyFatRange, type BodyFatCalibrationDto, type CreateBodyFatCalibrationInput } from "@fitnesstracker/shared";
import { BadRequestError, NotFoundError } from "../../errors/httpErrors.js";

const DAY_MS = 24 * 60 * 60 * 1000;
// A tape measurement this close to the reference scan counts as "the same time".
const MAX_GAP_DAYS = 7;
const round1 = (value: number) => Math.round(value * 10) / 10;

export function toBodyFatCalibrationDto(row: BodyFatCalibration): BodyFatCalibrationDto {
  return {
    id: row.id,
    measuredOn: row.measuredOn.toISOString().slice(0, 10),
    referencePercent: Number(row.referencePercent),
    estimatePercent: Number(row.estimatePercent),
    offsetPercent: Number(row.offsetPercent),
  };
}

export function listCalibrations(prisma: PrismaClient, userId: string) {
  return prisma.bodyFatCalibration.findMany({ where: { userId }, orderBy: { measuredOn: "desc" } });
}

// The offset is reference minus the middle of the formula range on the tape measurement nearest to
// the reference day, so it is only as good as that measurement: without one close enough there is
// nothing to compare against and the entry is refused.
export async function createCalibration(prisma: PrismaClient, userId: string, input: CreateBodyFatCalibrationInput) {
  const day = new Date(`${input.measuredOn}T00:00:00.000Z`);
  if (Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== input.measuredOn) {
    throw new BadRequestError("Das Datum ist ungültig.");
  }
  const profile = await prisma.profile.findUnique({ where: { userId }, select: { heightCm: true, gender: true } });
  if (!profile) {
    throw new BadRequestError("Für die Kalibrierung brauchst du Größe und Geschlecht im Tab „Rechner“.");
  }

  const noon = day.getTime() + DAY_MS / 2;
  const candidates = await prisma.bodyCompositionEntry.findMany({
    where: {
      userId,
      waistCm: { not: null },
      measuredAt: { gte: new Date(day.getTime() - MAX_GAP_DAYS * DAY_MS), lt: new Date(day.getTime() + (MAX_GAP_DAYS + 1) * DAY_MS) },
    },
  });
  const nearest = candidates.sort(
    (a, b) => Math.abs(a.measuredAt.getTime() - noon) - Math.abs(b.measuredAt.getTime() - noon),
  )[0];
  if (!nearest) {
    throw new BadRequestError(
      `Für den Vergleich fehlt eine Messung mit Taillenumfang innerhalb von ${MAX_GAP_DAYS} Tagen um dieses Datum.`,
    );
  }

  const range = bodyFatRange({
    heightCm: profile.heightCm,
    gender: profile.gender,
    waistCm: Number(nearest.waistCm),
    neckCm: nearest.neckCm === null ? null : Number(nearest.neckCm),
    hipCm: nearest.hipCm === null ? null : Number(nearest.hipCm),
  });
  if (!range) {
    throw new BadRequestError("Aus dieser Messung lässt sich keine Schätzung berechnen.");
  }
  const estimate = round1((range.low + range.high) / 2);
  return prisma.bodyFatCalibration.create({
    data: {
      userId,
      measuredOn: day,
      referencePercent: input.referencePercent,
      estimatePercent: estimate,
      offsetPercent: round1(input.referencePercent - estimate),
    },
  });
}

export async function deleteCalibration(prisma: PrismaClient, userId: string, id: string) {
  const existing = await prisma.bodyFatCalibration.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existing) throw new NotFoundError("Calibration not found");
  await prisma.bodyFatCalibration.delete({ where: { id } });
}

import { Prisma, type PrismaClient, type TrainingPhase } from "@prisma/client";
import { buildSetPlan, type CreatePlanExerciseInput, type SetScheme, type UpdatePlanExerciseInput } from "@fitnesstracker/shared";
import { ConflictError, NotFoundError } from "../../errors/httpErrors.js";
import { planExerciseInclude } from "./planExercise.types.js";
import { visibleToUser } from "../exercises/exercise.service.js";

const withExercise = { include: planExerciseInclude } as const;

// The per-set prescription of a scheme, built from the entry's own sets and rep range.
export function setPlanFor(
  scheme: SetScheme | null | undefined,
  sets: number | null,
  repMin: number | null,
  repMax: number | null,
  targetReps: number | null,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  const max = repMax ?? targetReps ?? 10;
  const min = repMin ?? Math.max(1, max - 4);
  const plan = buildSetPlan(scheme, sets ?? 3, min, max);
  return plan ? (plan as unknown as Prisma.InputJsonValue) : Prisma.JsonNull;
}

export function listPlanExercises(prisma: PrismaClient, userId: string, phase: TrainingPhase) {
  return prisma.planExercise.findMany({
    where: { userId, phase },
    orderBy: { order: "asc" },
    ...withExercise,
  });
}

export async function createPlanExercise(
  prisma: PrismaClient,
  userId: string,
  input: CreatePlanExerciseInput,
) {
  const exercise = await prisma.exercise.findFirst({ where: { id: input.exerciseId, ...visibleToUser(userId) } });
  if (!exercise) {
    throw new NotFoundError("Exercise not found");
  }

  // Manual entries belong to the selected split day (or stay ungrouped for a single-day plan).
  // `findFirst` rather than
  // `findUnique`: Prisma's compound-unique-input type doesn't accept `null` for a nullable
  // field even though the underlying index does, and at most one row can match this combination
  // anyway (the same unique index guarantees it).
  const existing = await prisma.planExercise.findFirst({
    where: {
      userId,
      phase: input.phase,
      exerciseId: input.exerciseId,
      dayLabel: input.dayLabel ?? null,
    },
  });
  if (existing) {
    throw new ConflictError("Exercise already assigned to this phase");
  }

  // Appended after the highest `order` of the whole phase, not of the day: the order of the split
  // days is the order in which their first entry appears (planWeekStatus.groupByDayLabel), so
  // every day restarting at 0 left that sequence — and with it "today's workout" — to chance.
  const last = await prisma.planExercise.findFirst({
    where: { userId, phase: input.phase },
    orderBy: { order: "desc" },
  });

  return prisma.planExercise.create({
    data: {
      userId,
      phase: input.phase,
      exerciseId: input.exerciseId,
      targetSets: input.targetSets,
      targetReps: input.targetReps,
      order: last ? last.order + 1 : 0,
      dayLabel: input.dayLabel ?? null,
      technique: input.technique ?? null,
      techniqueGroup: input.techniqueGroup ?? null,
      setScheme: input.setScheme && input.setScheme !== "STRAIGHT" ? input.setScheme : null,
      setPlan: setPlanFor(input.setScheme, input.targetSets ?? null, null, null, input.targetReps ?? null),
    },
    ...withExercise,
  });
}

export async function updatePlanExercise(
  prisma: PrismaClient,
  userId: string,
  id: string,
  input: UpdatePlanExerciseInput,
) {
  const existing = await prisma.planExercise.findFirst({ where: { id, userId } });
  if (!existing) {
    throw new NotFoundError("Plan exercise not found");
  }

  if (input.exerciseId && input.exerciseId !== existing.exerciseId) {
    const exercise = await prisma.exercise.findFirst({ where: { id: input.exerciseId, ...visibleToUser(userId) } });
    if (!exercise) throw new NotFoundError("Exercise not found");
    const duplicate = await prisma.planExercise.findFirst({
      where: {
        userId,
        phase: existing.phase,
        exerciseId: input.exerciseId,
        dayLabel: existing.dayLabel,
        id: { not: id },
      },
    });
    if (duplicate) throw new ConflictError("Exercise already assigned to this training day");
  }

  const swapped = input.exerciseId !== undefined && input.exerciseId !== existing.exerciseId;
  // A new scheme, or new sets under a scheme, rebuilds the per-set prescription.
  const scheme = input.setScheme !== undefined ? (input.setScheme === "STRAIGHT" ? null : input.setScheme) : (existing.setScheme as SetScheme | null);
  const rebuildPlan = input.setScheme !== undefined || (input.targetSets !== undefined && scheme !== null);
  return prisma.planExercise.update({
    where: { id },
    data: {
      exerciseId: input.exerciseId,
      targetSets: input.targetSets,
      targetReps: input.targetReps,
      order: input.order,
      technique: input.technique,
      // Without a technique there is no group to belong to.
      techniqueGroup: input.techniqueGroup !== undefined ? input.techniqueGroup : input.technique === null ? null : undefined,
      ...(input.setScheme !== undefined ? { setScheme: scheme } : {}),
      ...(rebuildPlan
        ? {
            setPlan: setPlanFor(
              scheme,
              input.targetSets !== undefined ? input.targetSets : existing.targetSets,
              existing.repRangeMin,
              existing.repRangeMax,
              input.targetReps !== undefined ? input.targetReps : existing.targetReps,
            ),
          }
        : {}),
      // The cue and start weight belong to the old exercise; it becomes the way back.
      ...(swapped ? { notes: null, startWeightKg: null, alternativeExerciseId: existing.exerciseId } : {}),
    },
    ...withExercise,
  });
}

export async function deletePlanExercise(prisma: PrismaClient, userId: string, id: string) {
  const existing = await prisma.planExercise.findFirst({ where: { id, userId } });
  if (!existing) {
    throw new NotFoundError("Plan exercise not found");
  }
  await prisma.planExercise.delete({ where: { id } });
}

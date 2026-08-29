import type { PrismaClient } from "@prisma/client";
import type { CreateWorkoutLogInput, UpdateWorkoutLogInput } from "@fitnesstracker/shared";
import { NotFoundError } from "../../errors/httpErrors.js";
import { sendNotificationToUser } from "../push/push.service.js";

const withExercise = { include: { exercise: true } } as const;

export function listWorkoutLogs(
  prisma: PrismaClient,
  userId: string,
  filters: { from?: string; to?: string; exerciseId?: string },
) {
  return prisma.workoutLog.findMany({
    where: {
      userId,
      deletedAt: null,
      exerciseId: filters.exerciseId,
      performedAt: {
        gte: filters.from ? new Date(filters.from) : undefined,
        lte: filters.to ? new Date(filters.to) : undefined,
      },
    },
    orderBy: { performedAt: "desc" },
    ...withExercise,
  });
}

// Idempotent by clientId: a retried submit (e.g. from a flaky connection, or later the offline
// sync queue) returns the existing row instead of throwing a unique-constraint error.
export function createWorkoutLog(prisma: PrismaClient, userId: string, input: CreateWorkoutLogInput) {
  return prisma.workoutLog.upsert({
    where: { clientId: input.clientId },
    update: {},
    create: {
      clientId: input.clientId,
      userId,
      exerciseId: input.exerciseId,
      setNumber: input.setNumber,
      reps: input.reps,
      weightKg: input.weightKg,
      rir: input.rir,
      supersetGroupId: input.supersetGroupId,
      performedAt: input.performedAt ? new Date(input.performedAt) : undefined,
    },
    ...withExercise,
  });
}

// `idOrClientId` accepts either identifier: the offline sync queue only ever knows a row's
// clientId (it may not have synced yet and gotten a server `id` at all), while any other caller
// uses the server id. Both are UUIDs so the route's param validation doesn't need to change.
async function findOwnedWorkoutLog(prisma: PrismaClient, userId: string, idOrClientId: string) {
  const existing = await prisma.workoutLog.findFirst({
    where: { userId, deletedAt: null, OR: [{ id: idOrClientId }, { clientId: idOrClientId }] },
  });
  if (!existing) {
    throw new NotFoundError("Workout log not found");
  }
  return existing;
}

export async function updateWorkoutLog(
  prisma: PrismaClient,
  userId: string,
  idOrClientId: string,
  input: UpdateWorkoutLogInput,
) {
  const existing = await findOwnedWorkoutLog(prisma, userId, idOrClientId);

  return prisma.workoutLog.update({
    where: { id: existing.id },
    data: {
      exerciseId: input.exerciseId,
      setNumber: input.setNumber,
      reps: input.reps,
      weightKg: input.weightKg,
      rir: input.rir,
      supersetGroupId: input.supersetGroupId,
      performedAt: input.performedAt ? new Date(input.performedAt) : undefined,
    },
    ...withExercise,
  });
}

export async function deleteWorkoutLog(prisma: PrismaClient, userId: string, idOrClientId: string) {
  const existing = await findOwnedWorkoutLog(prisma, userId, idOrClientId);
  await prisma.workoutLog.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
}

// Server-side counterpart to the frontend's client-side PR toast (prDetection.ts) — this one
// covers weight/rep records only (not estimated-1RM/volume, to keep the extra query on this hot
// write path to a single aggregate) and exists specifically so a record still triggers a push
// even when the app isn't open to show the in-app toast, e.g. a set synced later from the
// offline queue. Fire-and-forget from the route, not awaited into the response.
export async function checkAndNotifyPersonalRecord(
  prisma: PrismaClient,
  userId: string,
  log: { id: string; exerciseId: string; reps: number; weightKg: number },
) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { remindPersonalRecords: true } });
  if (!user?.remindPersonalRecords) return;

  const priorBest = await prisma.workoutLog.aggregate({
    where: { userId, exerciseId: log.exerciseId, deletedAt: null, id: { not: log.id } },
    _max: { weightKg: true, reps: true },
  });
  const priorMaxWeight = Number(priorBest._max.weightKg ?? 0);
  const priorMaxReps = priorBest._max.reps ?? 0;
  // No prior sets at all — a debut set trivially "beats" a nonexistent baseline, which isn't a
  // record worth announcing (same guard as the client-side detector).
  if (priorMaxWeight === 0 && priorMaxReps === 0) return;

  const isWeightPR = log.weightKg > priorMaxWeight;
  const isRepPR = log.reps > priorMaxReps;
  if (!isWeightPR && !isRepPR) return;

  const exercise = await prisma.exercise.findUnique({ where: { id: log.exerciseId } });
  const exerciseName = exercise ? (exercise.nameDe ?? exercise.name) : "Übung";
  const labels = [isWeightPR ? "Gewicht" : null, isRepPR ? "Wiederholungen" : null]
    .filter((l): l is string => l !== null)
    .join(" · ");

  await sendNotificationToUser(prisma, userId, {
    title: `🏆 Neuer Rekord — ${exerciseName}`,
    body: labels,
    url: "/progress",
  });
}

// Local UTC hour, not per-user local time — User has no stored timezone (only Supplement does,
// per-reminder), and inventing a whole account-level timezone preference just for this one
// reminder would be disproportionate. A fixed UTC evening hour is an accepted simplification.
const REMINDER_HOUR_UTC = 20;

function todayUtcDateOnly(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

// Once-daily nudge if nothing was logged today and the current plan still has work left this
// week — never fires for a paused plan (pausing is an explicit "not training right now" signal)
// or a plan with no exercises configured yet (nothing to be reminded about).
export async function sendDueWorkoutReminders(prisma: PrismaClient): Promise<{ sent: number }> {
  if (new Date().getUTCHours() < REMINDER_HOUR_UTC) return { sent: 0 };
  const today = todayUtcDateOnly();

  const candidates = await prisma.user.findMany({
    where: {
      remindWorkout: true,
      OR: [{ lastWorkoutReminderSentOn: null }, { lastWorkoutReminderSentOn: { lt: today } }],
      trainingPlan: { pausedAt: null },
    },
    select: { id: true, trainingPlan: { select: { currentPhase: true } } },
  });

  let sent = 0;
  for (const user of candidates) {
    if (!user.trainingPlan) continue;

    const [loggedToday, planExerciseCount] = await Promise.all([
      prisma.workoutLog.count({ where: { userId: user.id, deletedAt: null, performedAt: { gte: today } } }),
      prisma.planExercise.count({ where: { userId: user.id, phase: user.trainingPlan.currentPhase } }),
    ]);
    if (loggedToday > 0 || planExerciseCount === 0) continue;

    await sendNotificationToUser(prisma, user.id, {
      title: "Training heute?",
      body: "Noch kein Satz heute protokolliert.",
      url: "/",
    });
    await prisma.user.update({ where: { id: user.id }, data: { lastWorkoutReminderSentOn: today } });
    sent += 1;
  }
  return { sent };
}

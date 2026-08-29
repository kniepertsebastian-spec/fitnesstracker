import type { PrismaClient } from "@prisma/client";
import { listWorkoutLogs } from "../workoutLogs/workoutLog.service.js";
import { toWorkoutLogDto } from "../workoutLogs/workoutLog.types.js";
import { listGoals, computeCurrentValue } from "../goals/goal.service.js";
import { toGoalDto } from "../goals/goal.types.js";
import { getCurrentTrainingPlan } from "../trainingPlan/trainingPlan.service.js";
import { toTrainingPlanDto } from "../trainingPlan/trainingPlan.types.js";
import { toPlanExerciseDto } from "../trainingPlan/planExercise.types.js";
import { listEntries } from "../bodyComposition/bodyComposition.service.js";
import { toBodyCompositionEntryDto } from "../bodyComposition/bodyComposition.types.js";
import { toCardioLogDto } from "../cardioLogs/cardioLog.types.js";
import { listSupplements } from "../supplements/supplement.service.js";
import { toSupplementDto } from "../supplements/supplement.types.js";
import { getProfile } from "../profile/profile.service.js";
import { toProfileDto } from "../profile/profile.types.js";
import { listPhotos } from "../progressPhotos/progressPhoto.service.js";
import { toProgressPhotoDto } from "../progressPhotos/progressPhoto.types.js";

// Everything a user might reasonably want in a portable copy of their own data — "persönliche
// Trainingsdaten sollen nicht ausschließlich an die App gebunden sein" (roadmap additionals
// P1.6). Deliberately excludes: passwordHash/refresh tokens (auth secrets), push subscription
// endpoints (third-party delivery addresses, not the user's own data), the AI provider's
// encrypted API key (a secret, not data to hand back in a plaintext download), and progress
// photo image bytes (only metadata here — the files themselves live on disk, not meant for a
// JSON export; a photo-bytes export would need a separate zip-based endpoint, out of scope here).
export async function buildFullBackup(prisma: PrismaClient, userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      email: true,
      displayName: true,
      remindPhaseChange: true,
      remindSupplements: true,
      remindProgressPhoto: true,
    },
  });

  const [
    workoutLogs,
    goals,
    { plan, nextRotationOn, history },
    planExercises,
    bodyCompositionEntries,
    cardioLogs,
    supplements,
    profile,
    progressPhotos,
  ] = await Promise.all([
    listWorkoutLogs(prisma, userId, {}),
    listGoals(prisma, userId),
    getCurrentTrainingPlan(prisma, userId),
    prisma.planExercise.findMany({
      where: { userId },
      include: { exercise: true },
      orderBy: [{ phase: "asc" }, { order: "asc" }],
    }),
    listEntries(prisma, userId),
    prisma.cardioLog.findMany({ where: { userId, deletedAt: null }, orderBy: { performedAt: "asc" } }),
    listSupplements(prisma, userId),
    getProfile(prisma, userId),
    listPhotos(prisma, userId),
  ]);

  const goalsWithCurrentValue = await Promise.all(
    goals.map(async (goal) => toGoalDto(goal, await computeCurrentValue(prisma, userId, goal))),
  );

  return {
    exportedAt: new Date().toISOString(),
    account: { email: user.email, displayName: user.displayName },
    settings: {
      remindPhaseChange: user.remindPhaseChange,
      remindSupplements: user.remindSupplements,
      remindProgressPhoto: user.remindProgressPhoto,
    },
    profile: profile ? toProfileDto(profile) : null,
    trainingPlan: toTrainingPlanDto(plan, nextRotationOn, history),
    planExercises: planExercises.map(toPlanExerciseDto),
    workoutLogs: workoutLogs.map(toWorkoutLogDto),
    goals: goalsWithCurrentValue,
    bodyCompositionEntries: bodyCompositionEntries.map(toBodyCompositionEntryDto),
    cardioLogs: cardioLogs.map(toCardioLogDto),
    supplements: supplements.map(toSupplementDto),
    // Metadata only, no image bytes — see the module comment above.
    progressPhotos: progressPhotos.map(toProgressPhotoDto),
  };
}

function csvEscape(value: string | number): string {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

const WORKOUT_CSV_HEADERS = ["Datum", "Übung", "Satz", "Wiederholungen", "Gewicht (kg)", "RIR", "Superset-Gruppe"];

// A flat, spreadsheet-friendly view of the same workout log data the JSON backup carries — the
// roadmap explicitly calls out CSV as its own minimum requirement alongside the JSON backup,
// since a spreadsheet is a much more directly useful format than JSON for "let me sum my volume
// this month" style ad-hoc analysis outside the app.
export async function buildWorkoutLogsCsv(prisma: PrismaClient, userId: string): Promise<string> {
  const logs = await listWorkoutLogs(prisma, userId, {});
  const rows = logs.map((log) =>
    [
      log.performedAt.toISOString(),
      log.exercise.nameDe ?? log.exercise.name,
      log.setNumber,
      log.reps,
      Number(log.weightKg),
      log.rir ?? "",
      log.supersetGroupId ?? "",
    ]
      .map(csvEscape)
      .join(","),
  );
  return [WORKOUT_CSV_HEADERS.join(","), ...rows].join("\n");
}

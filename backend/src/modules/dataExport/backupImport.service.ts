import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  GOAL_TYPES,
  TRAINING_PHASES,
  backupFileSchema,
  cardioMachineSchema,
  dataSourceSchema,
  hipCmSchema,
  neckCmSchema,
  phaseConfigItemSchema,
  scaleDetailsSchema,
  upsertProfileSchema,
  waistCmSchema,
  type BackupFile,
  type BackupImportResult,
} from "@fitnesstracker/shared";
import { BadRequestError, ConflictError } from "../../errors/httpErrors.js";

// Restores an account from the file `GET /export/backup.json` wrote. It only ever fills an EMPTY
// account: merging two histories would need conflict rules for every table, and "restore" is the
// one case where there is nothing to merge with. Rows get fresh ids (a client id is unique across
// the whole server, so reusing it would collide with the original account on the same server);
// rows that are incomplete or refer to an exercise that cannot be found are skipped and counted.

const dateTime = z.string().datetime();
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const nullableNumber = z.number().nullable().optional();

const workoutLogRow = z.object({
  exerciseId: z.string(),
  exerciseName: z.string().optional(),
  setNumber: z.number().int().positive(),
  reps: z.number().int().positive(),
  weightKg: z.number().min(0).max(9999),
  rir: z.number().int().min(0).max(10).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  supersetGroupId: z.string().uuid().nullable().optional(),
  performedAt: dateTime,
});

const goalRow = z.object({
  type: z.enum(GOAL_TYPES),
  exerciseId: z.string().nullable().optional(),
  exerciseName: z.string().nullable().optional(),
  targetValue: z.number().positive().max(9999),
  targetDate: z.string().nullable().optional(),
  achievedAt: z.string().nullable().optional(),
});

const planExerciseRow = z.object({
  phase: z.enum(TRAINING_PHASES),
  exerciseId: z.string(),
  exerciseName: z.string().optional(),
  targetSets: z.number().int().positive().nullable().optional(),
  targetReps: z.number().int().positive().nullable().optional(),
  order: z.number().int().optional(),
  dayLabel: z.string().nullable().optional(),
  repRangeMin: z.number().int().nullable().optional(),
  repRangeMax: z.number().int().nullable().optional(),
  targetRir: z.number().int().nullable().optional(),
  restSeconds: z.number().int().nullable().optional(),
  notes: z.string().nullable().optional(),
  startWeightKg: nullableNumber,
  alternativeExerciseId: z.string().nullable().optional(),
  alternativeExerciseName: z.string().nullable().optional(),
});

const bodyRow = z.object({
  measuredAt: dateTime,
  weightKg: z.number().positive().max(500),
  bodyFatPercent: z.number().min(0).max(100).nullable().optional(),
  muscleMassKg: z.number().positive().max(500).nullable().optional(),
  bodyWaterPercent: z.number().min(0).max(100).nullable().optional(),
  waistCm: waistCmSchema.nullable().optional(),
  neckCm: neckCmSchema.nullable().optional(),
  hipCm: hipCmSchema.nullable().optional(),
  scaleDetails: z.unknown().optional(),
});

const calibrationRow = z.object({
  measuredOn: dateOnly,
  referencePercent: z.number().min(2).max(70),
  estimatePercent: z.number().min(0).max(100),
  offsetPercent: z.number().min(-100).max(100),
});

const cardioRow = z.object({
  machine: cardioMachineSchema,
  level: z.number().int().nullable().optional(),
  intensity: z.string().max(200),
  durationMinutes: z.number().int().min(0).max(100000),
  distanceKm: z.number().min(0).max(9999).nullable().optional(),
  source: dataSourceSchema.optional(),
  performedAt: dateTime,
});

const cardioPlanDayRow = z.object({
  phase: z.enum(TRAINING_PHASES),
  dayLabel: z.string(),
  items: z.unknown(),
});

const supplementRow = z.object({
  name: z.string().min(1).max(100),
  reminderTime: z.string().regex(/^\d{2}:\d{2}$/),
  timeZone: z.string().min(1),
  enabled: z.boolean().optional(),
  aiAnalysis: z.unknown().optional(),
});

const dailyActivityRow = z.object({
  date: dateOnly,
  steps: z.number().int().min(0),
  distanceMeters: z.number().min(0).nullable().optional(),
});

const cyclingRow = z.object({
  startedAt: dateTime,
  endedAt: dateTime,
  durationSeconds: z.number().int().min(0),
  distanceMeters: z.number().min(0).nullable().optional(),
  title: z.string().max(200).nullable().optional(),
});

const planRow = z.object({
  currentPhase: z.enum(TRAINING_PHASES),
  phaseStartedOn: z.string(),
  pausedAt: z.string().nullable().optional(),
  extensionWeeks: z.number().int().min(0).optional(),
  trainingGoal: z.enum(["MUSCLE_GAIN", "STRENGTH", "ENDURANCE", "FAT_LOSS", "GENERAL_FITNESS"]).nullable().optional(),
  remarks: z.string().max(2000).nullable().optional(),
  detectedAsymmetries: z.array(z.string()).optional(),
  asymmetryAnalyzedAt: z.string().nullable().optional(),
  phases: z.array(phaseConfigItemSchema).optional(),
  history: z
    .array(z.object({ phase: z.enum(TRAINING_PHASES), startedOn: z.string(), endedOn: z.string().nullable().optional() }))
    .optional(),
});

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Valid rows (parsed) and the number of rows that did not fit. */
function parseRows<T extends z.ZodTypeAny>(rows: unknown[] | undefined, schema: T) {
  const ok: z.infer<T>[] = [];
  let skipped = 0;
  for (const row of rows ?? []) {
    const parsed = schema.safeParse(row);
    if (parsed.success) ok.push(parsed.data);
    else skipped += 1;
  }
  return { ok, skipped };
}

async function assertAccountIsEmpty(prisma: PrismaClient, userId: string) {
  const counts = await Promise.all([
    prisma.workoutLog.count({ where: { userId } }),
    prisma.goal.count({ where: { userId } }),
    prisma.planExercise.count({ where: { userId } }),
    prisma.bodyCompositionEntry.count({ where: { userId } }),
    prisma.cardioLog.count({ where: { userId } }),
    prisma.supplement.count({ where: { userId } }),
    prisma.progressPhoto.count({ where: { userId } }),
    prisma.bodyFatCalibration.count({ where: { userId } }),
  ]);
  if (counts.some((count) => count > 0)) {
    throw new ConflictError(
      "Der Import geht nur in ein leeres Konto. In diesem Konto gibt es schon Daten. Lege ein neues Konto an und spiele die Sicherung dort ein.",
    );
  }
}

// Exercise ids in a backup point at rows that may not exist (another server, or an exercise
// deleted since). Resolution order: same id and visible to this user, else a visible exercise
// with the same name, else a new private exercise with that name. Without a name there is
// nothing to restore it from.
async function resolveExercises(
  prisma: Prisma.TransactionClient,
  userId: string,
  wanted: Map<string, string | undefined>,
) {
  const resolved = new Map<string, string>();
  let created = 0;
  const visible = { OR: [{ ownerId: null }, { ownerId: userId }] };
  for (const [id, name] of wanted) {
    const byId = z.string().uuid().safeParse(id).success
      ? await prisma.exercise.findFirst({ where: { id, ...visible }, select: { id: true } })
      : null;
    if (byId) {
      resolved.set(id, byId.id);
      continue;
    }
    const cleanName = name?.trim();
    if (!cleanName) continue;
    const byName = await prisma.exercise.findFirst({
      where: {
        AND: [
          visible,
          { isActive: true },
          { OR: [{ name: { equals: cleanName, mode: "insensitive" } }, { nameDe: { equals: cleanName, mode: "insensitive" } }] },
        ],
      },
      orderBy: { ownerId: { sort: "asc", nulls: "first" } },
      select: { id: true },
    });
    if (byName) {
      resolved.set(id, byName.id);
      continue;
    }
    const createdExercise = await prisma.exercise.create({
      data: { name: cleanName, source: "backup-import", sourceId: randomUUID(), ownerId: userId },
      select: { id: true },
    });
    resolved.set(id, createdExercise.id);
    created += 1;
  }
  return { resolved, created };
}

export async function importBackup(prisma: PrismaClient, userId: string, raw: unknown): Promise<BackupImportResult> {
  const file = backupFileSchema.safeParse(raw);
  if (!file.success || typeof raw !== "object" || raw === null) {
    throw new BadRequestError("Das ist keine Fitnesstracker-Sicherung (backup.json).");
  }
  const backup: BackupFile = file.data;
  const knownSections = [
    backup.workoutLogs,
    backup.goals,
    backup.planExercises,
    backup.bodyCompositionEntries,
    backup.cardioLogs,
    backup.profile,
    backup.trainingPlan,
  ];
  if (backup.exportedAt === undefined && knownSections.every((section) => section === undefined)) {
    throw new BadRequestError("Das ist keine Fitnesstracker-Sicherung (backup.json).");
  }

  await assertAccountIsEmpty(prisma, userId);

  const logs = parseRows(backup.workoutLogs, workoutLogRow);
  const goals = parseRows(backup.goals, goalRow);
  const planExercises = parseRows(backup.planExercises, planExerciseRow);
  const bodyEntries = parseRows(backup.bodyCompositionEntries, bodyRow);
  const calibrations = parseRows(backup.bodyFatCalibrations, calibrationRow);
  const cardioLogs = parseRows(backup.cardioLogs, cardioRow);
  const cardioPlanDays = parseRows(backup.cardioPlanDays, cardioPlanDayRow);
  const supplements = parseRows(backup.supplements, supplementRow);
  const activities = parseRows(backup.dailyActivities, dailyActivityRow);
  const rides = parseRows(backup.cyclingSessions, cyclingRow);
  const profile = backup.profile ? upsertProfileSchema.safeParse(backup.profile) : null;
  const plan = backup.trainingPlan ? planRow.safeParse(backup.trainingPlan) : null;

  const wanted = new Map<string, string | undefined>();
  const want = (id: string | null | undefined, name: string | null | undefined) => {
    if (id && (name || !wanted.has(id))) wanted.set(id, name ?? wanted.get(id));
  };
  for (const row of logs.ok) want(row.exerciseId, row.exerciseName);
  for (const row of goals.ok) want(row.exerciseId, row.exerciseName);
  for (const row of planExercises.ok) {
    want(row.exerciseId, row.exerciseName);
    want(row.alternativeExerciseId, row.alternativeExerciseName);
  }

  const imported: Record<string, number> = {};
  const skipped: Record<string, number> = {};
  const count = (section: string, written: number, left: number) => {
    imported[section] = written;
    if (left > 0) skipped[section] = left;
  };

  let createdExercises = 0;
  await prisma.$transaction(
    async (tx) => {
      const { resolved, created } = await resolveExercises(tx, userId, wanted);
      createdExercises = created;

      if (backup.settings) {
        await tx.user.update({
          where: { id: userId },
          data: {
            ...(backup.settings.remindPhaseChange !== undefined && { remindPhaseChange: backup.settings.remindPhaseChange }),
            ...(backup.settings.remindSupplements !== undefined && { remindSupplements: backup.settings.remindSupplements }),
            ...(backup.settings.remindProgressPhoto !== undefined && { remindProgressPhoto: backup.settings.remindProgressPhoto }),
          },
        });
      }

      if (profile?.success) {
        await tx.profile.upsert({
          where: { userId },
          create: { userId, ...profile.data },
          update: profile.data,
        });
        count("profile", 1, 0);
      } else if (backup.profile) {
        count("profile", 0, 1);
      }

      if (plan?.success) {
        const p = plan.data;
        const data = {
          currentPhase: p.currentPhase,
          phaseStartedOn: toDate(p.phaseStartedOn) ?? new Date(),
          pausedAt: toDate(p.pausedAt),
          extensionWeeks: p.extensionWeeks ?? 0,
          trainingGoal: p.trainingGoal ?? null,
          remarks: p.remarks ?? null,
          detectedAsymmetries: p.detectedAsymmetries ?? [],
          asymmetryAnalyzedAt: toDate(p.asymmetryAnalyzedAt),
          ...(p.phases && p.phases.length > 0 && { phaseConfigs: p.phases as unknown as Prisma.InputJsonValue }),
        };
        const saved = await tx.trainingPlan.upsert({ where: { userId }, create: { userId, ...data }, update: data });
        await tx.trainingPlanPhaseHistory.deleteMany({ where: { trainingPlanId: saved.id } });
        const history = (p.history ?? [])
          .map((h) => ({ phase: h.phase, startedOn: toDate(h.startedOn), endedOn: toDate(h.endedOn) }))
          .filter((h): h is { phase: (typeof TRAINING_PHASES)[number]; startedOn: Date; endedOn: Date | null } => h.startedOn !== null);
        if (history.length > 0) {
          await tx.trainingPlanPhaseHistory.createMany({
            data: history.map((h) => ({ trainingPlanId: saved.id, ...h })),
            skipDuplicates: true,
          });
        }
        count("trainingPlan", 1, 0);
      } else if (backup.trainingPlan) {
        count("trainingPlan", 0, 1);
      }

      const planData = planExercises.ok.flatMap((row) => {
        const exerciseId = resolved.get(row.exerciseId);
        if (!exerciseId) return [];
        return [
          {
            userId,
            phase: row.phase,
            exerciseId,
            targetSets: row.targetSets ?? null,
            targetReps: row.targetReps ?? null,
            order: row.order ?? 0,
            dayLabel: row.dayLabel ?? null,
            repRangeMin: row.repRangeMin ?? null,
            repRangeMax: row.repRangeMax ?? null,
            targetRir: row.targetRir ?? null,
            restSeconds: row.restSeconds ?? null,
            notes: row.notes ?? null,
            startWeightKg: row.startWeightKg ?? null,
            alternativeExerciseId: row.alternativeExerciseId ? (resolved.get(row.alternativeExerciseId) ?? null) : null,
          },
        ];
      });
      const planResult = await tx.planExercise.createMany({ data: planData, skipDuplicates: true });
      count("planExercises", planResult.count, planExercises.skipped + (planExercises.ok.length - planResult.count));

      const logData = logs.ok.flatMap((row) => {
        const exerciseId = resolved.get(row.exerciseId);
        if (!exerciseId) return [];
        return [
          {
            clientId: randomUUID(),
            userId,
            exerciseId,
            setNumber: row.setNumber,
            reps: row.reps,
            weightKg: row.weightKg,
            rir: row.rir ?? null,
            note: row.note ?? null,
            supersetGroupId: row.supersetGroupId ?? null,
            performedAt: new Date(row.performedAt),
          },
        ];
      });
      const logResult = await tx.workoutLog.createMany({ data: logData });
      count("workoutLogs", logResult.count, logs.skipped + (logs.ok.length - logData.length));

      const goalData = goals.ok.flatMap((row) => {
        const needsExercise = row.type === "WEIGHT" || row.type === "REPS";
        const exerciseId = row.exerciseId ? (resolved.get(row.exerciseId) ?? null) : null;
        if (needsExercise && !exerciseId) return [];
        return [
          {
            userId,
            type: row.type,
            exerciseId,
            targetValue: row.targetValue,
            targetDate: toDate(row.targetDate),
            achievedAt: toDate(row.achievedAt),
          },
        ];
      });
      const goalResult = await tx.goal.createMany({ data: goalData });
      count("goals", goalResult.count, goals.skipped + (goals.ok.length - goalData.length));

      const bodyResult = await tx.bodyCompositionEntry.createMany({
        data: bodyEntries.ok.map((row) => {
          const details = row.scaleDetails ? scaleDetailsSchema.safeParse(row.scaleDetails) : null;
          return {
            userId,
            measuredAt: new Date(row.measuredAt),
            weightKg: row.weightKg,
            bodyFatPercent: row.bodyFatPercent ?? null,
            muscleMassKg: row.muscleMassKg ?? null,
            bodyWaterPercent: row.bodyWaterPercent ?? null,
            waistCm: row.waistCm ?? null,
            neckCm: row.neckCm ?? null,
            hipCm: row.hipCm ?? null,
            ...(details?.success && { scaleDetails: details.data as Prisma.InputJsonValue }),
          };
        }),
      });
      count("bodyCompositionEntries", bodyResult.count, bodyEntries.skipped);

      const calibrationResult = await tx.bodyFatCalibration.createMany({
        data: calibrations.ok.map((row) => ({
          userId,
          measuredOn: new Date(`${row.measuredOn}T00:00:00.000Z`),
          referencePercent: row.referencePercent,
          estimatePercent: row.estimatePercent,
          offsetPercent: row.offsetPercent,
        })),
      });
      count("bodyFatCalibrations", calibrationResult.count, calibrations.skipped);

      const cardioResult = await tx.cardioLog.createMany({
        data: cardioLogs.ok.map((row) => ({
          clientId: randomUUID(),
          userId,
          machine: row.machine,
          level: row.level ?? null,
          intensity: row.intensity,
          durationMinutes: row.durationMinutes,
          distanceKm: row.distanceKm ?? null,
          source: row.source ?? "MANUAL",
          performedAt: new Date(row.performedAt),
        })),
      });
      count("cardioLogs", cardioResult.count, cardioLogs.skipped);

      const cardioPlanResult = await tx.cardioPlanDay.createMany({
        data: cardioPlanDays.ok.map((row) => ({
          userId,
          phase: row.phase,
          dayLabel: row.dayLabel,
          items: (row.items ?? []) as Prisma.InputJsonValue,
        })),
        skipDuplicates: true,
      });
      count("cardioPlanDays", cardioPlanResult.count, cardioPlanDays.skipped);

      const supplementResult = await tx.supplement.createMany({
        data: supplements.ok.map((row) => ({
          userId,
          name: row.name,
          reminderTime: row.reminderTime,
          timeZone: row.timeZone,
          enabled: row.enabled ?? true,
          ...(row.aiAnalysis ? { aiAnalysis: row.aiAnalysis as Prisma.InputJsonValue } : {}),
        })),
      });
      count("supplements", supplementResult.count, supplements.skipped);

      const activityResult = await tx.dailyActivity.createMany({
        data: activities.ok.map((row) => ({
          userId,
          date: new Date(`${row.date}T00:00:00.000Z`),
          steps: row.steps,
          distanceMeters: row.distanceMeters ?? null,
          source: "backup",
        })),
        skipDuplicates: true,
      });
      count("dailyActivities", activityResult.count, activities.skipped);

      const rideResult = await tx.cyclingSession.createMany({
        data: rides.ok.map((row) => ({
          userId,
          externalId: `backup-${row.startedAt}`,
          startedAt: new Date(row.startedAt),
          endedAt: new Date(row.endedAt),
          durationSeconds: row.durationSeconds,
          distanceMeters: row.distanceMeters ?? null,
          title: row.title ?? null,
          source: "backup",
        })),
        skipDuplicates: true,
      });
      count("cyclingSessions", rideResult.count, rides.skipped);
    },
    { timeout: 120_000, maxWait: 10_000 },
  );

  return {
    imported,
    skipped,
    createdExercises,
    photosNotImported: backup.progressPhotos?.length ?? 0,
  };
}

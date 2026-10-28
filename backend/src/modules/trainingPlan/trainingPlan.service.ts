import type { Prisma, PrismaClient, TrainingPhase, TrainingPlan, TrainingPlanPhaseHistory } from "@prisma/client";
import {
  CUSTOM_TRAINING_PHASES,
  TRAINING_PHASE_ROTATION,
  type AddTrainingPhaseInput,
  type RenameTrainingPhaseInput,
} from "@fitnesstracker/shared";
import { BadRequestError, ConflictError, NotFoundError } from "../../errors/httpErrors.js";
import { sendNotificationToUser } from "../push/push.service.js";
import { refreshDetectedAsymmetries } from "./trainingAsymmetry.service.js";
import {
  getDefaultPhaseConfigs,
  getPhaseLabel,
  getRotationalPhases,
  resolvePhaseConfigs,
} from "./trainingPlan.types.js";

const ROTATION_WEEKS = 8;
// Upper bound for "+1 Woche" so a phase can't be stretched indefinitely by accident.
export const MAX_EXTENSION_WEEKS = 8;

const ALL_ROTATIONAL_SLOTS: TrainingPhase[] = [
  ...TRAINING_PHASE_ROTATION,
  ...CUSTOM_TRAINING_PHASES,
];

function nextPhase(phase: TrainingPlan["currentPhase"], rotation: TrainingPhase[]) {
  if (rotation.length === 0) return phase;
  const index = rotation.indexOf(phase);
  if (index === -1) return rotation[0];
  return rotation[(index + 1) % rotation.length];
}

function addWeeks(date: Date, weeks: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + weeks * 7);
  return result;
}

// Normalizes to UTC midnight of the Monday of `date`'s week — `phaseStartedOn` is always a
// Monday so that "8 weeks later" also always lands on a Monday.
function mostRecentMonday(date: Date) {
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() - daysSinceMonday);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

export async function getOrCreateTrainingPlan(
  prisma: PrismaClient,
  userId: string,
): Promise<TrainingPlan> {
  const existing = await prisma.trainingPlan.findUnique({ where: { userId } });
  if (existing) return existing;

  return prisma.trainingPlan.create({
    data: {
      userId,
      currentPhase: "AUFBAU",
      phaseStartedOn: mostRecentMonday(new Date()),
      phaseConfigs: getDefaultPhaseConfigs() as unknown as Prisma.InputJsonValue,
    },
  });
}

export interface RotationComputation {
  currentPhase: TrainingPlan["currentPhase"];
  phaseStartedOn: Date;
  nextRotationOn: Date;
  closedHistory: Array<Pick<TrainingPlanPhaseHistory, "phase" | "startedOn" | "endedOn">>;
}

// Pure phase math. The current phase lasts 8 weeks plus any "+1 Woche" extension; every phase
// after it is a plain 8 weeks (the extension belongs to the phase it was added to).
// Non-rotational phases (such as DAILY) are ignored by the rotation cycle.
export function computeRotation(
  plan: Pick<TrainingPlan, "currentPhase" | "phaseStartedOn" | "extensionWeeks"> & {
    phaseConfigs?: unknown;
  },
  now: Date,
): RotationComputation {
  const configs = resolvePhaseConfigs(plan.phaseConfigs);
  const rotation = getRotationalPhases(configs);

  let currentPhase = plan.currentPhase;
  let phaseStartedOn = plan.phaseStartedOn;
  let nextRotationOn = addWeeks(phaseStartedOn, ROTATION_WEEKS + plan.extensionWeeks);
  const closedHistory: RotationComputation["closedHistory"] = [];

  while (nextRotationOn <= now) {
    closedHistory.push({ phase: currentPhase, startedOn: phaseStartedOn, endedOn: nextRotationOn });
    currentPhase = nextPhase(currentPhase, rotation);
    phaseStartedOn = nextRotationOn;
    nextRotationOn = addWeeks(phaseStartedOn, ROTATION_WEEKS);
  }

  return { currentPhase, phaseStartedOn, nextRotationOn, closedHistory };
}

export interface RotationResult {
  plan: TrainingPlan;
  // Null while the plan is paused — there's nothing due to compute since the clock isn't
  // advancing.
  nextRotationOn: Date | null;
  rotated: boolean;
}

// Advances `plan` through as many overdue 8-week cycles as needed (covers the case where the
// scheduler tick was missed, e.g. the server was down) and persists the result. Each cycle
// crossed leaves a closed TrainingPlanPhaseHistory row behind as an audit trail.
export async function rotatePhaseIfDue(
  prisma: PrismaClient,
  plan: TrainingPlan,
): Promise<RotationResult> {
  if (plan.pausedAt) {
    return { plan, nextRotationOn: null, rotated: false };
  }

  const { currentPhase, phaseStartedOn, nextRotationOn, closedHistory } = computeRotation(plan, new Date());

  if (closedHistory.length === 0) {
    return { plan, nextRotationOn, rotated: false };
  }

  const [, updatedPlan] = await prisma.$transaction([
    prisma.trainingPlanPhaseHistory.createMany({
      data: closedHistory.map((entry) => ({ ...entry, trainingPlanId: plan.id })),
      skipDuplicates: true,
    }),
    prisma.trainingPlan.update({
      where: { id: plan.id },
      data: { currentPhase, phaseStartedOn, extensionWeeks: 0 },
    }),
  ]);

  return { plan: updatedPlan, nextRotationOn, rotated: true };
}

// Used by the GET route: ensures the plan exists and reflects the current phase even if the
// background scheduler hasn't ticked since the last due rotation.
export async function getCurrentTrainingPlan(prisma: PrismaClient, userId: string) {
  const plan = await getOrCreateTrainingPlan(prisma, userId);
  const { plan: rotatedPlan, nextRotationOn } = await rotatePhaseIfDue(prisma, plan);
  const current = (await refreshDetectedAsymmetries(prisma, userId)) ?? rotatedPlan;
  const history = await prisma.trainingPlanPhaseHistory.findMany({
    where: { trainingPlanId: current.id },
    orderBy: { startedOn: "desc" },
  });
  return { plan: current, nextRotationOn, history };
}

// Manually switches the active rotational phase and starts a fresh 8-week cycle.
// Switching to a daily phase is prevented here so the active rotation plan remains untouched.
export async function changeTrainingPhase(
  prisma: PrismaClient,
  userId: string,
  phase: TrainingPlan["currentPhase"],
) {
  const plan = await getOrCreateTrainingPlan(prisma, userId);
  const configs = resolvePhaseConfigs(plan.phaseConfigs);
  const targetConfig = configs.find((c) => c.phase === phase);

  if (!targetConfig) {
    throw new NotFoundError("Trainingsphase existiert nicht im Plan");
  }
  if (targetConfig.isDaily) {
    throw new BadRequestError(
      "Die Daily-Phase läuft parallel und ersetzt nicht deine aktive Rotationsphase.",
    );
  }
  if (plan.currentPhase === phase) return plan;

  const phaseStartedOn = mostRecentMonday(new Date());
  const [, updatedPlan] = await prisma.$transaction([
    prisma.trainingPlanPhaseHistory.create({
      data: {
        trainingPlanId: plan.id,
        phase: plan.currentPhase,
        startedOn: plan.phaseStartedOn,
        endedOn: phaseStartedOn,
      },
    }),
    prisma.trainingPlan.update({
      where: { id: plan.id },
      data: {
        currentPhase: phase,
        phaseStartedOn,
        extensionWeeks: 0,
        pausedAt: null,
      },
    }),
  ]);
  return updatedPlan;
}

// Adds a new rotational training phase or the standalone DAILY phase without touching the
// current rotational plan state.
export async function addTrainingPhase(
  prisma: PrismaClient,
  userId: string,
  input: AddTrainingPhaseInput,
) {
  const plan = await getOrCreateTrainingPlan(prisma, userId);
  const configs = resolvePhaseConfigs(plan.phaseConfigs);
  const trimmedLabel = input.label.trim();

  if (input.isDaily) {
    if (configs.some((c) => c.isDaily || c.phase === "DAILY")) {
      throw new ConflictError("Eine Daily-Trainingsphase existiert bereits.");
    }
    const nextConfigs = [...configs, { phase: "DAILY" as const, label: trimmedLabel, isDaily: true }];
    return prisma.trainingPlan.update({
      where: { id: plan.id },
      data: { phaseConfigs: nextConfigs as unknown as Prisma.InputJsonValue },
    });
  }

  const usedPhases = new Set(configs.map((c) => c.phase));
  const availableSlot = ALL_ROTATIONAL_SLOTS.find((slot) => !usedPhases.has(slot));
  if (!availableSlot) {
    throw new ConflictError("Maximale Anzahl an Trainingsphasen (8) erreicht.");
  }

  // Insert rotational phases before DAILY if DAILY is present so rotation order stays clean.
  const dailyEntries = configs.filter((c) => c.isDaily);
  const rotationalEntries = configs.filter((c) => !c.isDaily);
  const nextConfigs = [
    ...rotationalEntries,
    { phase: availableSlot, label: trimmedLabel, isDaily: false },
    ...dailyEntries,
  ];

  return prisma.trainingPlan.update({
    where: { id: plan.id },
    data: { phaseConfigs: nextConfigs as unknown as Prisma.InputJsonValue },
  });
}

// Renames any phase (standard, custom, or DAILY) without affecting exercises or rotation timing.
export async function renameTrainingPhase(
  prisma: PrismaClient,
  userId: string,
  phase: TrainingPhase,
  input: RenameTrainingPhaseInput,
) {
  const plan = await getOrCreateTrainingPlan(prisma, userId);
  const configs = resolvePhaseConfigs(plan.phaseConfigs);
  const idx = configs.findIndex((c) => c.phase === phase);

  if (idx === -1) {
    throw new NotFoundError("Trainingsphase nicht gefunden.");
  }

  const nextConfigs = configs.map((c, i) =>
    i === idx ? { ...c, label: input.label.trim() } : c,
  );

  return prisma.trainingPlan.update({
    where: { id: plan.id },
    data: { phaseConfigs: nextConfigs as unknown as Prisma.InputJsonValue },
  });
}

// Deletes a phase and removes its assigned exercises, cardio, and stretch items.
// Protects the last remaining rotational phase so the plan always has an active phase.
export async function deleteTrainingPhase(
  prisma: PrismaClient,
  userId: string,
  phase: TrainingPhase,
) {
  const plan = await getOrCreateTrainingPlan(prisma, userId);
  const configs = resolvePhaseConfigs(plan.phaseConfigs);
  const target = configs.find((c) => c.phase === phase);

  if (!target) {
    throw new NotFoundError("Trainingsphase nicht gefunden.");
  }

  const remainingConfigs = configs.filter((c) => c.phase !== phase);
  const remainingRotational = remainingConfigs.filter((c) => !c.isDaily);

  if (!target.isDaily && remainingRotational.length === 0) {
    throw new BadRequestError("Mindestens eine reguläre Trainingsphase muss erhalten bleiben.");
  }

  const nextActivePhase =
    plan.currentPhase === phase ? remainingRotational[0].phase : plan.currentPhase;

  const [, , , , updatedPlan] = await prisma.$transaction([
    prisma.planExercise.deleteMany({ where: { userId, phase } }),
    prisma.cardioPlanDay.deleteMany({ where: { userId, phase } }),
    prisma.stretchPlanItem.deleteMany({ where: { userId, phase } }),
    prisma.planSnapshot.deleteMany({ where: { userId, phase } }),
    prisma.trainingPlan.update({
      where: { id: plan.id },
      data: {
        currentPhase: nextActivePhase,
        phaseConfigs: remainingConfigs as unknown as Prisma.InputJsonValue,
      },
    }),
  ]);

  return updatedPlan;
}

export async function updateTrainingPlanRemarks(
  prisma: PrismaClient,
  userId: string,
  remarks: string | null,
) {
  const plan = await getOrCreateTrainingPlan(prisma, userId);
  return prisma.trainingPlan.update({
    where: { id: plan.id },
    data: { remarks: remarks?.trim() || null },
  });
}

// Scheduler tick: rotates every plan with an overdue phase. Cheap to call often — plans that
// aren't due are filtered out in SQL before any rotation logic runs.
export async function rotateAllDuePlans(prisma: PrismaClient): Promise<{ rotatedPlans: number }> {
  const cutoff = addWeeks(new Date(), -ROTATION_WEEKS);
  const duePlans = await prisma.trainingPlan.findMany({
    where: { phaseStartedOn: { lte: cutoff }, pausedAt: null },
    include: { user: { select: { remindPhaseChange: true } } },
  });

  let rotatedPlans = 0;
  for (const plan of duePlans) {
    const { plan: updated, rotated } = await rotatePhaseIfDue(prisma, plan);
    if (rotated) {
      rotatedPlans += 1;
      if (plan.user.remindPhaseChange) {
        const configs = resolvePhaseConfigs(updated.phaseConfigs);
        await sendNotificationToUser(prisma, plan.userId, {
          title: "Trainingsplan-Wechsel",
          body: `Neue Phase: ${getPhaseLabel(configs, updated.currentPhase)}`,
          url: "/plan",
        });
      }
    }
  }
  return { rotatedPlans };
}

export async function pauseTrainingPlan(prisma: PrismaClient, userId: string) {
  const plan = await getOrCreateTrainingPlan(prisma, userId);
  if (plan.pausedAt) return plan;
  return prisma.trainingPlan.update({ where: { id: plan.id }, data: { pausedAt: new Date() } });
}

export async function resumeTrainingPlan(prisma: PrismaClient, userId: string) {
  const plan = await getOrCreateTrainingPlan(prisma, userId);
  if (!plan.pausedAt) return plan;
  const pausedForMs = Date.now() - plan.pausedAt.getTime();
  return prisma.trainingPlan.update({
    where: { id: plan.id },
    data: {
      pausedAt: null,
      phaseStartedOn: new Date(plan.phaseStartedOn.getTime() + pausedForMs),
    },
  });
}

export async function restartCurrentPhase(prisma: PrismaClient, userId: string) {
  const plan = await getOrCreateTrainingPlan(prisma, userId);
  return prisma.trainingPlan.update({
    where: { id: plan.id },
    data: { phaseStartedOn: mostRecentMonday(new Date()), pausedAt: null, extensionWeeks: 0 },
  });
}

export async function extendCurrentPhase(prisma: PrismaClient, userId: string) {
  const plan = await getOrCreateTrainingPlan(prisma, userId);
  if (plan.extensionWeeks >= MAX_EXTENSION_WEEKS) return plan;
  return prisma.trainingPlan.update({
    where: { id: plan.id },
    data: { extensionWeeks: { increment: 1 } },
  });
}

export async function setTrainingGoal(
  prisma: PrismaClient,
  userId: string,
  goal: TrainingPlan["trainingGoal"],
) {
  const plan = await getOrCreateTrainingPlan(prisma, userId);
  return prisma.trainingPlan.update({ where: { id: plan.id }, data: { trainingGoal: goal } });
}

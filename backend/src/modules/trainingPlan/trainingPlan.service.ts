import type { PrismaClient, TrainingPlan, TrainingPlanPhaseHistory } from "@prisma/client";
import { TRAINING_PHASE_LABELS, TRAINING_PHASE_ROTATION } from "@fitnesstracker/shared";
import { sendNotificationToUser } from "../push/push.service.js";

const ROTATION_WEEKS = 8;

function nextPhase(phase: TrainingPlan["currentPhase"]) {
  const index = TRAINING_PHASE_ROTATION.indexOf(phase);
  return TRAINING_PHASE_ROTATION[(index + 1) % TRAINING_PHASE_ROTATION.length];
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
    data: { userId, currentPhase: "AUFBAU", phaseStartedOn: mostRecentMonday(new Date()) },
  });
}

export interface RotationResult {
  plan: TrainingPlan;
  nextRotationOn: Date;
  rotated: boolean;
}

// Advances `plan` through as many overdue 8-week cycles as needed (covers the case where the
// scheduler tick was missed, e.g. the server was down) and persists the result. Each cycle
// crossed leaves a closed TrainingPlanPhaseHistory row behind as an audit trail.
export async function rotatePhaseIfDue(
  prisma: PrismaClient,
  plan: TrainingPlan,
): Promise<RotationResult> {
  const now = new Date();
  let currentPhase = plan.currentPhase;
  let phaseStartedOn = plan.phaseStartedOn;
  let nextRotationOn = addWeeks(phaseStartedOn, ROTATION_WEEKS);
  const closedHistory: Array<Pick<TrainingPlanPhaseHistory, "phase" | "startedOn" | "endedOn">> = [];

  while (nextRotationOn <= now) {
    closedHistory.push({ phase: currentPhase, startedOn: phaseStartedOn, endedOn: nextRotationOn });
    currentPhase = nextPhase(currentPhase);
    phaseStartedOn = nextRotationOn;
    nextRotationOn = addWeeks(phaseStartedOn, ROTATION_WEEKS);
  }

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
      data: { currentPhase, phaseStartedOn },
    }),
  ]);

  return { plan: updatedPlan, nextRotationOn, rotated: true };
}

// Used by the GET route: ensures the plan exists and reflects the current phase even if the
// background scheduler hasn't ticked since the last due rotation.
export async function getCurrentTrainingPlan(prisma: PrismaClient, userId: string) {
  const plan = await getOrCreateTrainingPlan(prisma, userId);
  const { plan: current, nextRotationOn } = await rotatePhaseIfDue(prisma, plan);
  const history = await prisma.trainingPlanPhaseHistory.findMany({
    where: { trainingPlanId: current.id },
    orderBy: { startedOn: "desc" },
  });
  return { plan: current, nextRotationOn, history };
}

// Scheduler tick: rotates every plan with an overdue phase. Cheap to call often — plans that
// aren't due are filtered out in SQL before any rotation logic runs.
//
// The push reminder fires only from here, not from the lazy per-request rotation in
// getCurrentTrainingPlan — a push telling you the plan changed is pointless if you're the one
// who just triggered the rotation by opening the training-plan page yourself.
export async function rotateAllDuePlans(prisma: PrismaClient): Promise<{ rotatedPlans: number }> {
  const cutoff = addWeeks(new Date(), -ROTATION_WEEKS);
  const duePlans = await prisma.trainingPlan.findMany({
    where: { phaseStartedOn: { lte: cutoff } },
  });

  let rotatedPlans = 0;
  for (const plan of duePlans) {
    const { plan: updated, rotated } = await rotatePhaseIfDue(prisma, plan);
    if (rotated) {
      rotatedPlans += 1;
      await sendNotificationToUser(prisma, plan.userId, {
        title: "Trainingsplan-Wechsel",
        body: `Neue Phase: ${TRAINING_PHASE_LABELS[updated.currentPhase]}`,
        url: "/plan",
      });
    }
  }
  return { rotatedPlans };
}

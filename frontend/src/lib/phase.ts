import type { TrainingPlanDto } from "@fitnesstracker/shared";

export const PHASE_WEEKS = 8;

// Total length of the current phase: 8 weeks plus any "+1 Woche" extensions.
export function phaseLength(plan: Pick<TrainingPlanDto, "extensionWeeks">): number {
  // `?? 0`: a cached older client/server pair may not send the field yet.
  return PHASE_WEEKS + (plan.extensionWeeks ?? 0);
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Week x of the current phase (1-based, capped at the phase length). `phaseStartedOn` is always a
// Monday (see the TrainingPlan model), so whole weeks since then is the week index.
export function phaseWeek(
  plan: Pick<TrainingPlanDto, "phaseStartedOn" | "pausedAt" | "extensionWeeks">,
  now = new Date(),
): number {
  const start = new Date(plan.phaseStartedOn).getTime();
  const until = plan.pausedAt ? new Date(plan.pausedAt).getTime() : now.getTime();
  const week = Math.floor((until - start) / (7 * DAY_MS)) + 1;
  return Math.max(1, Math.min(phaseLength(plan), week));
}

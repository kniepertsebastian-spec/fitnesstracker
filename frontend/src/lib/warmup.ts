// Warm-up ramp before the first working set: lighter sets that prepare the joints without tiring
// the muscle. Suggestions only — they are ticked off on the screen but never logged, so they cannot
// count toward volume, personal records, progression or the history.

export interface WarmupSet {
  percent: number;
  weightKg: number;
  reps: number;
}

const RAMP = [
  { percent: 40, reps: 8 },
  { percent: 60, reps: 5 },
  { percent: 80, reps: 3 },
];
const ROUND_TO_KG = 2.5;
// Below this working weight a ramp is pointless (the first set is already light).
const MIN_WORKING_KG = 25;

function roundToStep(value: number): number {
  return Math.round(value / ROUND_TO_KG) * ROUND_TO_KG;
}

// `barKg` is the lightest possible load (the empty bar for a barbell, 0 for everything else).
// Steps that would round to the same weight, fall below the bar or reach the working weight are
// dropped, so a 30 kg working set gets a short ramp instead of three identical lines.
export function warmupSets(workingKg: number, barKg = 0): WarmupSet[] {
  if (!Number.isFinite(workingKg) || workingKg < MIN_WORKING_KG) return [];
  const sets: WarmupSet[] = [];
  for (const step of RAMP) {
    const weightKg = Math.max(barKg, roundToStep((workingKg * step.percent) / 100));
    const previous = sets.at(-1);
    if (weightKg >= workingKg || (previous && weightKg <= previous.weightKg)) continue;
    sets.push({ percent: step.percent, weightKg, reps: step.reps });
  }
  return sets;
}

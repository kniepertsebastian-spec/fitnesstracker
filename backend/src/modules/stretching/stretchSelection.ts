// Pure selection logic for stretch routines — no DB, so it's unit-testable.

export interface StretchCandidate {
  id: string;
  name: string;
  nameDe: string | null;
  description: string | null;
  imageUrls: string[];
  primaryMuscles: string[];
  secondaryMuscles: string[];
}

export const DEFAULT_HOLD_SECONDS = 30;
const MAX_ITEMS_PER_DAY = 6;
const DAILY_ITEMS = 5;
// Broad default when no focus is picked: one stretch per big region, in head-to-toe order.
const FULL_BODY_MUSCLES = ["shoulders", "chest", "lats", "lower back", "glutes", "hamstrings", "quadriceps", "calves"];

// FNV-1a — a small stable string hash, so "random per day" is repeatable for the same seed
// (a reload must show the same routine) without storing anything.
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededOrder<T extends { id: string }>(items: T[], seed: string): T[] {
  return [...items].sort((a, b) => hash(`${seed}:${a.id}`) - hash(`${seed}:${b.id}`));
}

// Muscles the day's training exercises load, most-trained first. Primary muscles count double
// against secondary ones, so a "Brust" day yields chest before the assisting triceps/shoulders.
export function rankMuscles(
  exercises: Array<{ primaryMuscles: string[]; secondaryMuscles: string[] }>,
): string[] {
  const score = new Map<string, number>();
  for (const ex of exercises) {
    for (const m of ex.primaryMuscles) score.set(m, (score.get(m) ?? 0) + 2);
    for (const m of ex.secondaryMuscles) score.set(m, (score.get(m) ?? 0) + 1);
  }
  return [...score.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([m]) => m);
}

// Round-robin over the muscles (primary-muscle matches first, then secondary) so a three-muscle
// day gets stretches for all three rather than six for the first one.
export function pickStretchesForMuscles(
  candidates: StretchCandidate[],
  muscles: string[],
  seed: string,
  limit = MAX_ITEMS_PER_DAY,
): StretchCandidate[] {
  const queues = muscles.map((muscle) => [
    ...seededOrder(candidates.filter((c) => c.primaryMuscles.includes(muscle)), `${seed}:${muscle}`),
    ...seededOrder(
      candidates.filter((c) => !c.primaryMuscles.includes(muscle) && c.secondaryMuscles.includes(muscle)),
      `${seed}:${muscle}`,
    ),
  ]);
  const picked: StretchCandidate[] = [];
  const used = new Set<string>();
  let progressed = true;
  while (picked.length < limit && progressed) {
    progressed = false;
    for (const queue of queues) {
      while (queue.length > 0 && used.has(queue[0].id)) queue.shift();
      const next = queue.shift();
      if (!next) continue;
      used.add(next.id);
      picked.push(next);
      progressed = true;
      if (picked.length >= limit) break;
    }
  }
  return picked;
}

export function pickDailyStretches(
  candidates: StretchCandidate[],
  focus: string | null,
  dateKey: string,
): StretchCandidate[] {
  if (!focus) return pickStretchesForMuscles(candidates, FULL_BODY_MUSCLES, dateKey, FULL_BODY_MUSCLES.length);
  return pickStretchesForMuscles(candidates, [focus], dateKey, DAILY_ITEMS);
}

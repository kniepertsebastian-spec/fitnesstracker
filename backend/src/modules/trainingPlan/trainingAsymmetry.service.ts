import type { PrismaClient } from "@prisma/client";

const HISTORY_WINDOW_MS = 8 * 7 * 24 * 60 * 60 * 1000;
const MIN_COMBINED_SETS = 8;
const IMBALANCE_RATIO = 2;

interface MusclePair {
  left: { keys: string[]; label: string };
  right: { keys: string[]; label: string };
}

const MUSCLE_PAIRS: MusclePair[] = [
  {
    left: { keys: ["chest"], label: "Brust/Drücken" },
    right: { keys: ["lats", "middle back"], label: "Rücken/Ziehen" },
  },
  {
    left: { keys: ["quadriceps"], label: "Quadrizeps" },
    right: { keys: ["hamstrings"], label: "Beinbeuger" },
  },
  {
    left: { keys: ["abdominals"], label: "Bauch" },
    right: { keys: ["lower back"], label: "unterer Rücken" },
  },
];

function countForKeys(counts: ReadonlyMap<string, number>, keys: string[]): number {
  return keys.reduce((sum, key) => sum + (counts.get(key) ?? 0), 0);
}

export function detectSetCountAsymmetries(counts: ReadonlyMap<string, number>): string[] {
  const remarks: string[] = [];
  for (const pair of MUSCLE_PAIRS) {
    const leftCount = countForKeys(counts, pair.left.keys);
    const rightCount = countForKeys(counts, pair.right.keys);
    if (leftCount + rightCount < MIN_COMBINED_SETS) continue;

    const stronger = leftCount >= rightCount ? pair.left : pair.right;
    const weaker = leftCount >= rightCount ? pair.right : pair.left;
    const strongerCount = Math.max(leftCount, rightCount);
    const weakerCount = Math.min(leftCount, rightCount);
    if (strongerCount < Math.max(1, weakerCount) * IMBALANCE_RATIO) continue;

    remarks.push(
      `${weaker.label} wurde deutlich seltener trainiert als ${stronger.label} ` +
      `(${weakerCount} vs. ${strongerCount} Sätze in 8 Wochen). Im nächsten Plan ausgleichen.`,
    );
  }
  return remarks;
}

export async function refreshDetectedAsymmetries(prisma: PrismaClient, userId: string) {
  const logs = await prisma.workoutLog.findMany({
    where: {
      userId,
      deletedAt: null,
      performedAt: { gte: new Date(Date.now() - HISTORY_WINDOW_MS) },
    },
    select: { exercise: { select: { primaryMuscles: true } } },
  });

  const counts = new Map<string, number>();
  for (const log of logs) {
    for (const muscle of new Set(log.exercise.primaryMuscles.map((value) => value.toLowerCase()))) {
      counts.set(muscle, (counts.get(muscle) ?? 0) + 1);
    }
  }
  const detectedAsymmetries = detectSetCountAsymmetries(counts);
  const plan = await prisma.trainingPlan.findUnique({ where: { userId } });
  if (!plan) return null;
  return prisma.trainingPlan.update({
    where: { id: plan.id },
    data: { detectedAsymmetries, asymmetryAnalyzedAt: new Date() },
  });
}

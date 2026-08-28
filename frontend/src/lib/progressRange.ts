export type ProgressRange = "4w" | "3m" | "1y" | "all";

export const PROGRESS_RANGE_LABELS: Record<ProgressRange, string> = {
  "4w": "4 Wochen",
  "3m": "3 Monate",
  "1y": "1 Jahr",
  all: "Gesamt",
};

const RANGE_DAYS: Record<Exclude<ProgressRange, "all">, number> = {
  "4w": 28,
  "3m": 90,
  "1y": 365,
};

// `null` for "all" — there's no cutoff, everything is in range.
export function rangeCutoff(range: ProgressRange): Date | null {
  if (range === "all") return null;
  const days = RANGE_DAYS[range];
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// The immediately preceding period of equal length, right before the range's own cutoff — used
// to compute a "vs. last period" trend. Meaningless for "all" (there's no prior period to
// compare against), so callers should skip the comparison in that case.
export function previousRangeCutoffs(range: ProgressRange): { start: Date; end: Date } | null {
  if (range === "all") return null;
  const days = RANGE_DAYS[range];
  const end = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return { start, end };
}

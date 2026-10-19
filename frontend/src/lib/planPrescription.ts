// One-line prescription for a plan exercise: "3 × 8–12 · RIR 2 · 120 s Pause". Fields the plan
// doesn't have (manual entries) are left out.
export interface Prescription {
  targetSets: number | null;
  targetReps: number | null;
  repRangeMin: number | null;
  repRangeMax: number | null;
  targetRir: number | null;
  restSeconds: number | null;
}

export function formatReps(p: Prescription): string | null {
  if (p.repRangeMin !== null && p.repRangeMax !== null) {
    return p.repRangeMin === p.repRangeMax ? String(p.repRangeMax) : `${p.repRangeMin}–${p.repRangeMax}`;
  }
  return p.targetReps !== null ? String(p.targetReps) : null;
}

export function formatPrescription(p: Prescription): string {
  const reps = formatReps(p);
  const volume = p.targetSets !== null && reps ? `${p.targetSets} × ${reps}` : (reps ?? (p.targetSets !== null ? `${p.targetSets} Sätze` : null));
  return [
    volume,
    p.targetRir !== null ? `RIR ${p.targetRir}` : null,
    p.restSeconds !== null ? `${p.restSeconds} s Pause` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

// "3 × 8–12" for list rows; `sets` overrides the plan's target (e.g. adjusted in the workout).
export function formatSetsReps(p: Prescription, sets: number | null = p.targetSets): string {
  return `${sets ?? "?"} × ${formatReps(p) ?? "–"}`;
}

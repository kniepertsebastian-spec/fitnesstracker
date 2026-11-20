// Text of the daily reminder: names what is still open today instead of a generic nudge. Pure, so it
// is unit-tested; the database lookups live in dailyChallenge.service.ts.

export interface OpenChallengeItem {
  name: string;
  completedReps: number;
  targetReps: number;
}

// Names shown in the push body; the rest is summarised as "+N weitere".
const MAX_NAMED = 3;

export function dailyReminderBody(challenge: OpenChallengeItem[], dailyExercises: string[]): string | null {
  const open = [
    ...challenge.map((i) => `${i.name} ${i.completedReps}/${i.targetReps}`),
    ...dailyExercises,
  ];
  if (open.length === 0) return null;
  const shown = open.slice(0, MAX_NAMED).join(" · ");
  const more = open.length - MAX_NAMED;
  return `Heute noch offen: ${shown}${more > 0 ? ` · +${more} weitere` : ""}`;
}

// UTC-calendar-day convention, same as daily-challenge/cardio/plan-week status on the server.
export function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isToday(iso: string): boolean {
  return utcDayKey(new Date(iso)) === utcDayKey(new Date());
}

// The seven UTC day keys of the current week, Monday first.
export function currentWeekDayKeys(): string[] {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const daysSinceMonday = today.getUTCDay() === 0 ? 6 : today.getUTCDay() - 1;
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - daysSinceMonday + i);
    return utcDayKey(d);
  });
}

// Consecutive trained days ending today — or yesterday, so the streak isn't shown as broken
// before today's session has happened.
export function trainingStreak(trainedDayKeys: ReadonlySet<string>): number {
  const cursor = new Date();
  if (!trainedDayKeys.has(utcDayKey(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;
  while (trainedDayKeys.has(utcDayKey(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

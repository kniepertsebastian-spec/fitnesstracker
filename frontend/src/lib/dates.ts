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

// --- Nachträgliches Protokollieren -----------------------------------------------------------
// Datum + Uhrzeit aus den nativen <input type="date|time">-Feldern (lokale Zeit des Geräts) und
// der ISO-Zeitpunkt, den die API als `performedAt` erwartet.

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** "YYYY-MM-DD" des lokalen Kalendertags (Format von <input type="date">). */
export function localDateInputValue(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** "HH:mm" der lokalen Uhrzeit (Format von <input type="time">). */
export function localTimeInputValue(date: Date = new Date()): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** Gestern als "YYYY-MM-DD" (lokal). */
export function localYesterdayInputValue(now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  return localDateInputValue(d);
}

/**
 * Lokales Datum + Uhrzeit → ISO-Zeitpunkt (UTC). `null` bei ungültiger oder unvollständiger
 * Eingabe (z. B. leeres Feld) — der Aufrufer zeigt dann einen Fehler statt zu raten.
 */
export function localDateTimeToIso(date: string, time: string): string | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!d || !t) return null;
  const [year, month, day, hour, minute] = [d[1], d[2], d[3], t[1], t[2]].map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ];
  const result = new Date(year, month - 1, day, hour, minute, 0, 0);
  // new Date rolls over impossible values (31.02. → 03.03.); treat that as invalid input.
  if (
    Number.isNaN(result.getTime()) ||
    result.getFullYear() !== year ||
    result.getMonth() !== month - 1 ||
    result.getDate() !== day
  ) {
    return null;
  }
  return result.toISOString();
}

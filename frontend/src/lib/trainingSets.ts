import type { LocalWorkoutLog } from "../offline/db";
import { utcDayKey } from "./dates";

function bySet(a: LocalWorkoutLog, b: LocalWorkoutLog) {
  return a.setNumber - b.setNumber || (a.performedAt < b.performedAt ? -1 : 1);
}

// Sets logged for one exercise since the session started — the source of truth for what is "done"
// in the focus mode, so a reload (or logging from the diary meanwhile) never desyncs the view.
export function sessionSets(logs: LocalWorkoutLog[], exerciseId: string, sessionStartedAt: string) {
  return logs
    .filter((l) => l.exerciseId === exerciseId && l.performedAt >= sessionStartedAt)
    .sort(bySet);
}

// The sets of the most recent earlier training day for the exercise ("Letztes Mal" / "Vorher").
export function lastTimeSets(logs: LocalWorkoutLog[], exerciseId: string, beforeIso: string) {
  const past = logs.filter((l) => l.exerciseId === exerciseId && l.performedAt < beforeIso);
  if (past.length === 0) return [];
  const lastDay = past.map((l) => utcDayKey(new Date(l.performedAt))).sort().at(-1)!;
  return past.filter((l) => utcDayKey(new Date(l.performedAt)) === lastDay).sort(bySet);
}

export function formatKg(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toLocaleString("de-DE", { maximumFractionDigits: 2 });
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

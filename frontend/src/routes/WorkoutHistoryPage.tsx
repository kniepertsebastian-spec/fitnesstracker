import { useMemo, useState } from "react";
import type { LocalWorkoutLog } from "../offline/db";
import { AppShell } from "../components/layout/AppShell";
import { WorkoutLogTable } from "../components/workoutLog/WorkoutLogTable";
import { WorkoutLogFormDialog } from "../components/workoutLog/WorkoutLogFormDialog";
import { useExercises, useWorkoutLogs } from "../hooks/useWorkoutLogs";

// How many day-groups render at once — the full history is already cached locally for offline
// use (see offline/workoutLogSync.ts), so windowing here is purely to keep the DOM small for
// someone with months of logs, not a data-fetching concern.
const DAYS_PER_PAGE = 14;

// Same UTC-calendar-day convention as WorkoutLogPage's isToday() and the rest of the app.
function dayKey(performedAt: string): string {
  const d = new Date(performedAt);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function dayLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const now = new Date();
  if (key === dayKey(now.toISOString())) return "Heute";
  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (key === dayKey(yesterday.toISOString())) return "Gestern";
  return date.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function groupByDay(logs: LocalWorkoutLog[]): { key: string; logs: LocalWorkoutLog[] }[] {
  const map = new Map<string, LocalWorkoutLog[]>();
  for (const log of logs) {
    const key = dayKey(log.performedAt);
    const group = map.get(key);
    if (group) group.push(log);
    else map.set(key, [log]);
  }
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([key, dayLogs]) => ({ key, logs: dayLogs }));
}

// Full training history, browsable by day and filterable by exercise — the counterpart to
// WorkoutLogPage's "today only" dashboard view. Reuses the same table/edit-dialog components as
// the dashboard so editing/deleting a past set works identically, just reachable for any day.
export function WorkoutHistoryPage() {
  const { data: logs, isLoading } = useWorkoutLogs();
  const { data: exercises } = useExercises();
  const [exerciseFilter, setExerciseFilter] = useState("");
  const [visibleDays, setVisibleDays] = useState(DAYS_PER_PAGE);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<LocalWorkoutLog | null>(null);

  const filtered = useMemo(
    () => (exerciseFilter ? (logs ?? []).filter((log) => log.exerciseId === exerciseFilter) : (logs ?? [])),
    [logs, exerciseFilter],
  );
  const groups = useMemo(() => groupByDay(filtered), [filtered]);
  const visibleGroups = groups.slice(0, visibleDays);

  const openEdit = (log: LocalWorkoutLog) => {
    setEditingLog(log);
    setDialogOpen(true);
  };

  return (
    <AppShell>
      <h1 className="mb-4 text-xl font-semibold">Historie</h1>

      <select
        value={exerciseFilter}
        onChange={(e) => {
          setExerciseFilter(e.target.value);
          setVisibleDays(DAYS_PER_PAGE);
        }}
        className="mb-4 w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-100"
      >
        <option value="">Alle Übungen</option>
        {exercises?.map((exercise) => (
          <option key={exercise.id} value={exercise.id}>
            {exercise.name}
          </option>
        ))}
      </select>

      {isLoading ? (
        <p className="text-ink-500">Lädt…</p>
      ) : groups.length === 0 ? (
        <p className="py-8 text-center text-ink-500">
          {exerciseFilter ? "Keine Sätze für diese Übung protokolliert." : "Noch keine Trainings protokolliert."}
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {visibleGroups.map((group) => (
            <div key={group.key}>
              <h2 className="mb-2 text-sm font-medium text-ink-400">{dayLabel(group.key)}</h2>
              <WorkoutLogTable logs={group.logs} onEdit={openEdit} />
            </div>
          ))}
          {groups.length > visibleDays && (
            <button
              onClick={() => setVisibleDays((v) => v + DAYS_PER_PAGE)}
              className="rounded-lg border border-ink-700 py-2 text-sm text-ink-300 hover:bg-ink-800"
            >
              Weitere Tage laden
            </button>
          )}
        </div>
      )}

      <WorkoutLogFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} editingLog={editingLog} />
    </AppShell>
  );
}

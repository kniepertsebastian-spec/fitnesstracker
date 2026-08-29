import { useEffect, useMemo, useState } from "react";
import type { LocalWorkoutLog } from "../offline/db";
import { AppShell } from "../components/layout/AppShell";
import { WorkoutLogFormDialog } from "../components/workoutLog/WorkoutLogFormDialog";
import { useDeleteWorkoutLog, useExercises, useWorkoutLogs } from "../hooks/useWorkoutLogs";

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

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

interface MonthView {
  year: number;
  month: number; // 0-indexed
}

function shiftMonth({ year, month }: MonthView, delta: number): MonthView {
  const total = year * 12 + month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

function isAtOrPastCurrentMonth({ year, month }: MonthView): boolean {
  const now = new Date();
  return year * 12 + month >= now.getUTCFullYear() * 12 + now.getUTCMonth();
}

function buildCalendarCells(year: number, month: number): (number | null)[] {
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  // Monday-first grid: getUTCDay() is 0=Sunday..6=Saturday, shift so Monday=0.
  const leadingBlanks = (firstOfMonth.getUTCDay() + 6) % 7;
  return [...Array(leadingBlanks).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
}

const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

interface CalendarProps {
  view: MonthView;
  dayKeysWithLogs: Set<string>;
  selectedDate: string | null;
  onSelectDay: (key: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

// A month grid instead of a scrolling day-by-day list — browsing stays bounded to ~31 cells no
// matter how many months of history exist, and only the selected day's data ever renders below it.
function HistoryCalendar({ view, dayKeysWithLogs, selectedDate, onSelectDay, onPrevMonth, onNextMonth }: CalendarProps) {
  const cells = buildCalendarCells(view.year, view.month);
  const monthLabel = new Date(Date.UTC(view.year, view.month, 1)).toLocaleDateString("de-DE", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="rounded-lg border border-ink-800 bg-ink-900 p-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          onClick={onPrevMonth}
          aria-label="Vorheriger Monat"
          className="rounded-lg px-2 py-1 text-ink-400 hover:bg-ink-800"
        >
          ‹
        </button>
        <p className="text-sm font-medium text-ink-100">{monthLabel}</p>
        <button
          onClick={onNextMonth}
          disabled={isAtOrPastCurrentMonth(view)}
          aria-label="Nächster Monat"
          className="rounded-lg px-2 py-1 text-ink-400 hover:bg-ink-800 disabled:opacity-30"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 pb-1 text-center text-xs text-ink-600">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />;
          const key = `${view.year}-${pad(view.month + 1)}-${pad(day)}`;
          const hasLogs = dayKeysWithLogs.has(key);
          const isSelected = key === selectedDate;
          return (
            <button
              key={i}
              onClick={() => onSelectDay(key)}
              disabled={!hasLogs}
              className={`aspect-square rounded-lg text-sm ${
                isSelected
                  ? "bg-violet-500 font-medium text-ink-950"
                  : hasLogs
                    ? "bg-ink-800 text-ink-100 hover:bg-ink-700"
                    : "text-ink-700"
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface ExerciseGroupProps {
  exerciseName: string;
  logs: LocalWorkoutLog[];
  onEdit: (log: LocalWorkoutLog) => void;
}

// One exercise's sets for the selected day, collapsed by default — a day with several exercises
// stays scannable as a stack of headers instead of one long flooded table.
function ExerciseLogGroup({ exerciseName, logs, onEdit }: ExerciseGroupProps) {
  const [open, setOpen] = useState(false);
  const deleteLog = useDeleteWorkoutLog();
  const sorted = [...logs].sort((a, b) => (a.performedAt < b.performedAt ? -1 : 1));

  return (
    <div className="overflow-hidden rounded-lg border border-ink-800 bg-ink-900">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <span className="font-medium text-ink-100">{exerciseName}</span>
        <span className="text-xs text-ink-500">
          {logs.length} {logs.length === 1 ? "Satz" : "Sätze"} {open ? "▲" : "▼"}
        </span>
      </button>
      {open && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-y border-ink-800 text-left text-xs text-ink-500">
              <th className="py-1.5 pl-3 pr-2 font-medium">Uhrzeit</th>
              <th className="py-1.5 pr-2 font-medium">Satz</th>
              <th className="py-1.5 pr-2 font-medium">Wdh.</th>
              <th className="py-1.5 pr-2 font-medium">kg</th>
              <th className="py-1.5 pr-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((log) => (
              <tr key={log.clientId} className="border-b border-ink-900 last:border-0">
                <td className="py-1.5 pl-3 pr-2 text-ink-400">{formatTime(log.performedAt)}</td>
                <td className="py-1.5 pr-2">{log.setNumber}</td>
                <td className="py-1.5 pr-2">{log.reps}</td>
                <td className="py-1.5 pr-2">{log.weightKg}</td>
                <td className="py-1.5 pr-3">
                  <div className="flex justify-end gap-3 text-xs">
                    <button onClick={() => onEdit(log)} className="text-violet-400 hover:underline">
                      Bearbeiten
                    </button>
                    <button
                      onClick={() => deleteLog.mutate(log.clientId)}
                      className="text-red-400 hover:underline"
                    >
                      Löschen
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// Full training history, browsed via a calendar instead of an ever-growing scroll list. Picking a
// day groups its sets by exercise into collapsible sections (with each set's time of day, since
// grouping by exercise loses the table's previous chronological order) — the counterpart to
// WorkoutLogPage's "today only" dashboard view, editing/deleting reuses the same dialog.
export function WorkoutHistoryPage() {
  const { data: logs, isLoading } = useWorkoutLogs();
  const { data: exercises } = useExercises();
  const [exerciseFilter, setExerciseFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<LocalWorkoutLog | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [view, setView] = useState<MonthView | null>(null);

  const filtered = useMemo(
    () => (exerciseFilter ? (logs ?? []).filter((log) => log.exerciseId === exerciseFilter) : (logs ?? [])),
    [logs, exerciseFilter],
  );

  const logsByDay = useMemo(() => {
    const map = new Map<string, LocalWorkoutLog[]>();
    for (const log of filtered) {
      const key = dayKey(log.performedAt);
      const group = map.get(key);
      if (group) group.push(log);
      else map.set(key, [log]);
    }
    return map;
  }, [filtered]);

  const mostRecentDay = useMemo(() => {
    const keys = [...logsByDay.keys()].sort();
    return keys.length > 0 ? (keys[keys.length - 1] ?? null) : null;
  }, [logsByDay]);

  // Defaults the calendar to the most recent logged month/day once data has loaded — doesn't
  // fight the user's own navigation afterwards, since it only fires while nothing is picked yet.
  useEffect(() => {
    if (selectedDate === null && mostRecentDay !== null) {
      setSelectedDate(mostRecentDay);
      const [y, m] = mostRecentDay.split("-").map(Number);
      setView({ year: y as number, month: (m as number) - 1 });
    }
  }, [mostRecentDay, selectedDate]);

  const selectedDayGroups = useMemo(() => {
    if (!selectedDate) return [];
    const dayLogs = logsByDay.get(selectedDate) ?? [];
    const byExercise = new Map<string, LocalWorkoutLog[]>();
    for (const log of dayLogs) {
      const group = byExercise.get(log.exerciseName);
      if (group) group.push(log);
      else byExercise.set(log.exerciseName, [log]);
    }
    return [...byExercise.entries()];
  }, [logsByDay, selectedDate]);

  const openEdit = (log: LocalWorkoutLog) => {
    setEditingLog(log);
    setDialogOpen(true);
  };

  return (
    <AppShell>
      <h1 className="mb-4 text-xl font-semibold">Historie</h1>

      <select
        value={exerciseFilter}
        onChange={(e) => setExerciseFilter(e.target.value)}
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
      ) : logsByDay.size === 0 ? (
        <p className="py-8 text-center text-ink-500">
          {exerciseFilter ? "Keine Sätze für diese Übung protokolliert." : "Noch keine Trainings protokolliert."}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {view && (
            <HistoryCalendar
              view={view}
              dayKeysWithLogs={new Set(logsByDay.keys())}
              selectedDate={selectedDate}
              onSelectDay={setSelectedDate}
              onPrevMonth={() => setView((v) => (v ? shiftMonth(v, -1) : v))}
              onNextMonth={() => setView((v) => (v ? shiftMonth(v, 1) : v))}
            />
          )}

          {selectedDate && (
            <div>
              <h2 className="mb-2 text-sm font-medium text-ink-400">{dayLabel(selectedDate)}</h2>
              {selectedDayGroups.length === 0 ? (
                <p className="text-sm text-ink-600">Keine Einträge für diese Auswahl.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {selectedDayGroups.map(([name, exerciseLogs]) => (
                    <ExerciseLogGroup key={name} exerciseName={name} logs={exerciseLogs} onEdit={openEdit} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <WorkoutLogFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} editingLog={editingLog} />
    </AppShell>
  );
}

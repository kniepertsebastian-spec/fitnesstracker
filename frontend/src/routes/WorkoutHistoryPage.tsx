import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import type { LocalWorkoutLog } from "../offline/db";
import { AppShell } from "../components/layout/AppShell";
import { WorkoutLogFormDialog } from "../components/workoutLog/WorkoutLogFormDialog";
import { Button, Card, Dialog, EmptyState, IconButton, Input, ListRow, Select, Skeleton, cn } from "../components/ui";
import { useDeleteWorkoutLog, useExercises, useWorkoutLogs } from "../hooks/useWorkoutLogs";
import { formatKg } from "../lib/trainingSets";
import { Dumbbell } from "lucide-react";

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
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <IconButton aria-label="Vorheriger Monat" onClick={onPrevMonth} className="border-transparent bg-transparent">
          <ChevronLeft size={18} aria-hidden />
        </IconButton>
        <p className="text-body font-medium text-text">{monthLabel}</p>
        <IconButton
          aria-label="Nächster Monat"
          onClick={onNextMonth}
          disabled={isAtOrPastCurrentMonth(view)}
          className="border-transparent bg-transparent"
        >
          <ChevronRight size={18} aria-hidden />
        </IconButton>
      </div>
      <div className="grid grid-cols-7 gap-1 pb-1 text-center text-xs text-text-faint">
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
              type="button"
              onClick={() => onSelectDay(key)}
              disabled={!hasLogs}
              aria-pressed={isSelected}
              aria-label={`${day}.${hasLogs ? " mit Training" : ""}`}
              className={cn(
                "tabular aspect-square min-h-9 rounded-lg text-small",
                isSelected
                  ? "bg-accent font-semibold text-on-accent"
                  : hasLogs
                    ? "bg-accent-soft text-text hover:bg-track"
                    : "text-text-faint",
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </Card>
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
  const [deleting, setDeleting] = useState<LocalWorkoutLog | null>(null);
  const deleteLog = useDeleteWorkoutLog();
  const sorted = [...logs].sort((a, b) => (a.performedAt < b.performedAt ? -1 : 1));

  return (
    <Card className="p-0 lg:p-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 text-left"
      >
        <span className="text-body font-medium text-text">{exerciseName}</span>
        <span className="flex items-center gap-2 text-small text-text-faint">
          {logs.length} {logs.length === 1 ? "Satz" : "Sätze"}
          <ChevronDown size={16} aria-hidden className={cn("transition-transform", open && "rotate-180")} />
        </span>
      </button>
      {open && (
        <div className="border-t border-border-subtle px-4">
          {sorted.map((log) => (
            <ListRow key={log.clientId} prefix={log.setNumber} value={`${log.reps} × ${formatKg(log.weightKg)} kg`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-small text-text-subtle">{formatTime(log.performedAt)}</span>
                <span className="flex">
                  <IconButton aria-label={`Satz ${log.setNumber} bearbeiten`} className="h-9 w-9 border-transparent bg-transparent" onClick={() => onEdit(log)}>
                    <Pencil size={16} aria-hidden />
                  </IconButton>
                  <IconButton aria-label={`Satz ${log.setNumber} löschen`} className="h-9 w-9 border-transparent bg-transparent hover:text-danger-text" onClick={() => setDeleting(log)}>
                    <Trash2 size={16} aria-hidden />
                  </IconButton>
                </span>
              </div>
            </ListRow>
          ))}
        </div>
      )}
      <Dialog
        open={deleting !== null}
        onOpenChange={(next) => !next && setDeleting(null)}
        title="Satz löschen?"
        description={deleting ? `${exerciseName} · Satz ${deleting.setNumber} · ${deleting.reps} × ${formatKg(deleting.weightKg)} kg` : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Abbrechen
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (deleting) deleteLog.mutate(deleting.clientId);
                setDeleting(null);
              }}
            >
              Löschen
            </Button>
          </>
        }
      >
        <p className="text-small text-text-subtle">Der Satz wird aus deiner Historie entfernt.</p>
      </Dialog>
    </Card>
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
  const [exerciseSearch, setExerciseSearch] = useState("");
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

  const visibleExercises = (exercises ?? []).filter((e) =>
    e.name.toLocaleLowerCase("de").includes(exerciseSearch.trim().toLocaleLowerCase("de")),
  );

  return (
    <AppShell>
      <h1 className="mb-4 text-h1 text-text lg:text-h1-lg">Historie</h1>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Input
          type="search"
          aria-label="Übung suchen"
          placeholder="Übung suchen…"
          value={exerciseSearch}
          onChange={(e) => setExerciseSearch(e.target.value)}
        />
        <Select aria-label="Übung filtern" value={exerciseFilter} onChange={(e) => setExerciseFilter(e.target.value)}>
          <option value="">Alle Übungen</option>
          {visibleExercises.map((exercise) => (
            <option key={exercise.id} value={exercise.id}>
              {exercise.name}
            </option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : logsByDay.size === 0 ? (
        <Card>
          <EmptyState
            icon={<Dumbbell size={18} aria-hidden />}
            text={exerciseFilter ? "Keine Sätze für diese Übung protokolliert." : "Noch keine Trainings protokolliert."}
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
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
              <h2 className="mb-2 text-h2 text-text">{dayLabel(selectedDate)}</h2>
              {selectedDayGroups.length === 0 ? (
                <p className="text-small text-text-faint">Keine Einträge für diese Auswahl.</p>
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

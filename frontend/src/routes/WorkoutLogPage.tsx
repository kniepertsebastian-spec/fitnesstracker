import { useState } from "react";
import type { LocalWorkoutLog } from "../offline/db";
import { AppShell } from "../components/layout/AppShell";
import { WorkoutLogTable } from "../components/workoutLog/WorkoutLogTable";
import { WorkoutLogFormDialog } from "../components/workoutLog/WorkoutLogFormDialog";
import { DailyChallengeCard } from "../components/workoutLog/DailyChallengeCard";
import { CurrentPlanCard } from "../components/workoutLog/CurrentPlanCard";
import { CardioLogCard } from "../components/workoutLog/CardioLogCard";
import { GoalsProgressCard } from "../components/workoutLog/GoalsProgressCard";
import { WorkoutSessionBar } from "../components/workoutLog/WorkoutSessionBar";
import { useWorkoutLogs } from "../hooks/useWorkoutLogs";

// Same UTC-calendar-day convention as daily-challenge/cardio elsewhere in the app.
function isToday(performedAt: string): boolean {
  const d = new Date(performedAt);
  const now = new Date();
  return (
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate()
  );
}

export function WorkoutLogPage() {
  const { data: logs, isLoading } = useWorkoutLogs();
  // Dashboard is "today's training" — the full log history is unbounded and quickly turns the
  // page into a scroll-forever list mixed in with the day's cards above it. Full history stays
  // available via each set's own edit/delete controls, just scoped down here; browsing past days
  // belongs to the separate history view, not this page.
  const todaysLogs = (logs ?? []).filter((log) => isToday(log.performedAt));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<LocalWorkoutLog | null>(null);

  const openCreate = () => {
    setEditingLog(null);
    setDialogOpen(true);
  };

  const openEdit = (log: LocalWorkoutLog) => {
    setEditingLog(log);
    setDialogOpen(true);
  };

  return (
    <AppShell>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Training</h1>
        <button
          onClick={openCreate}
          className="rounded-lg bg-violet-500 px-3 py-1.5 text-sm font-medium text-ink-950 hover:bg-violet-400"
        >
          + Satz
        </button>
      </div>

      <WorkoutSessionBar />

      <div className="mb-4 flex flex-col gap-4">
        <DailyChallengeCard />
        <CurrentPlanCard />
        <CardioLogCard />
        <GoalsProgressCard />
      </div>

      <h2 className="mb-2 text-sm font-medium text-ink-400">Heute</h2>
      {isLoading ? (
        <p className="text-ink-500">Lädt…</p>
      ) : (
        <WorkoutLogTable logs={todaysLogs} onEdit={openEdit} />
      )}

      <WorkoutLogFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editingLog={editingLog}
      />
    </AppShell>
  );
}

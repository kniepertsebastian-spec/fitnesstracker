import { useState } from "react";
import { Link } from "react-router-dom";
import type { LocalWorkoutLog } from "../offline/db";
import { AppShell } from "../components/layout/AppShell";
import { WorkoutLogTable } from "../components/workoutLog/WorkoutLogTable";
import { WorkoutLogFormDialog } from "../components/workoutLog/WorkoutLogFormDialog";
import { CurrentPlanCard } from "../components/workoutLog/CurrentPlanCard";
import { GoalsProgressCard } from "../components/workoutLog/GoalsProgressCard";
import { WorkoutSessionBar } from "../components/workoutLog/WorkoutSessionBar";
import { useWorkoutLogs } from "../hooks/useWorkoutLogs";
import { isToday } from "../lib/dates";

export function DiaryPage() {
  const { data: logs, isLoading } = useWorkoutLogs();
  // Only today's sets are listed here — the full history is unbounded and belongs to /history.
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
        <h1 className="text-xl font-semibold">Fitnesstagebuch</h1>
        <button
          onClick={openCreate}
          className="rounded-lg bg-violet-500 px-3 py-1.5 text-sm font-medium text-ink-950 hover:bg-violet-400"
        >
          + Satz
        </button>
      </div>

      <WorkoutSessionBar />

      <div className="mb-4 flex flex-col gap-4">
        <CurrentPlanCard />
        <GoalsProgressCard />
      </div>

      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium text-ink-400">Heute</h2>
        <div className="flex gap-3 text-xs">
          <Link to="/history" className="text-violet-400 hover:underline">
            Historie
          </Link>
          <Link to="/progress" className="text-violet-400 hover:underline">
            Fortschritt
          </Link>
        </div>
      </div>
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

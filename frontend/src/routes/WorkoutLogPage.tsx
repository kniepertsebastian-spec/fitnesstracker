import { useState } from "react";
import type { LocalWorkoutLog } from "../offline/db";
import { AppShell } from "../components/layout/AppShell";
import { WorkoutLogTable } from "../components/workoutLog/WorkoutLogTable";
import { WorkoutLogFormDialog } from "../components/workoutLog/WorkoutLogFormDialog";
import { DailyChallengeCard } from "../components/workoutLog/DailyChallengeCard";
import { useWorkoutLogs } from "../hooks/useWorkoutLogs";

export function WorkoutLogPage() {
  const { data: logs, isLoading } = useWorkoutLogs();
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

      <div className="mb-4">
        <DailyChallengeCard />
      </div>

      {isLoading ? (
        <p className="text-ink-500">Lädt…</p>
      ) : (
        <WorkoutLogTable logs={logs ?? []} onEdit={openEdit} />
      )}

      <WorkoutLogFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editingLog={editingLog}
      />
    </AppShell>
  );
}

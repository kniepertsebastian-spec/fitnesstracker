import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import type { LocalWorkoutLog } from "../offline/db";
import { AppShell } from "../components/layout/AppShell";
import { WorkoutLogTable } from "../components/workoutLog/WorkoutLogTable";
import { WorkoutLogFormDialog } from "../components/workoutLog/WorkoutLogFormDialog";
import { PlanTodayCard } from "../components/workoutLog/PlanTodayCard";
import { GoalsProgressCard } from "../components/workoutLog/GoalsProgressCard";
import { WorkoutSessionBar } from "../components/workoutLog/WorkoutSessionBar";
import { Button, Card, Skeleton } from "../components/ui";
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
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-h1 text-text lg:text-h1-lg">Fitnesstagebuch</h1>
        <Button variant="primary" iconLeft={<Plus size={18} aria-hidden />} onClick={openCreate}>
          Satz
        </Button>
      </div>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-4">
          <WorkoutSessionBar />
          <PlanTodayCard />
          <GoalsProgressCard />
        </div>

        <Card
          title="Heute"
          action={
            <span className="flex gap-3 text-small">
              <Link to="/history" className="text-accent hover:text-accent-hover">
                Historie
              </Link>
              <Link to="/progress" className="text-accent hover:text-accent-hover">
                Fortschritt
              </Link>
            </span>
          }
        >
          {isLoading ? <Skeleton className="h-24 w-full" /> : <WorkoutLogTable logs={todaysLogs} onEdit={openEdit} />}
        </Card>
      </div>

      <WorkoutLogFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} editingLog={editingLog} />
    </AppShell>
  );
}

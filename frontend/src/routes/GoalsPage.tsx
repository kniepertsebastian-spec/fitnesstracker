import { useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { GoalCard } from "../components/goals/GoalCard";
import { GoalFormDialog } from "../components/goals/GoalFormDialog";
import { useGoals } from "../hooks/useGoals";

export function GoalsPage() {
  const { data: goals, isLoading } = useGoals();
  const [dialogOpen, setDialogOpen] = useState(false);

  const open = goals?.filter((g) => !g.achievedAt) ?? [];
  const achieved = goals?.filter((g) => g.achievedAt) ?? [];

  return (
    <AppShell>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Ziele</h1>
        <button
          onClick={() => setDialogOpen(true)}
          className="rounded-lg bg-violet-500 px-3 py-1.5 text-sm font-medium text-slate-950 hover:bg-violet-400"
        >
          + Ziel
        </button>
      </div>

      {isLoading ? (
        <p className="text-slate-500">Lädt…</p>
      ) : !goals || goals.length === 0 ? (
        <p className="text-slate-500">Noch keine Ziele gesetzt.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            {open.length === 0 ? (
              <p className="text-sm text-slate-600">Keine offenen Ziele.</p>
            ) : (
              open.map((goal) => <GoalCard key={goal.id} goal={goal} />)
            )}
          </div>

          {achieved.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-medium text-slate-400">Erreicht</h2>
              <div className="flex flex-col gap-2">
                {achieved.map((goal) => (
                  <GoalCard key={goal.id} goal={goal} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <GoalFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </AppShell>
  );
}

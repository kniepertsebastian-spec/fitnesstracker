import { useState } from "react";
import { Plus, Target } from "lucide-react";
import type { GoalDto } from "@fitnesstracker/shared";
import { AppShell } from "../components/layout/AppShell";
import { GoalCard } from "../components/goals/GoalCard";
import { GoalFormDialog } from "../components/goals/GoalFormDialog";
import { GoalSuggestionsCard } from "../components/goals/GoalSuggestionsCard";
import { Button, Card, EmptyState, Skeleton } from "../components/ui";
import { useGoals } from "../hooks/useGoals";

export function GoalsPage() {
  const { data: goals, isLoading } = useGoals();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalDto | null>(null);

  const open = goals?.filter((g) => !g.achievedAt) ?? [];
  const achieved = goals?.filter((g) => g.achievedAt) ?? [];

  const openCreate = () => {
    setEditingGoal(null);
    setDialogOpen(true);
  };

  const openEdit = (goal: GoalDto) => {
    setEditingGoal(goal);
    setDialogOpen(true);
  };

  return (
    <AppShell>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-h1 text-text lg:text-h1-lg">Ziele</h1>
        <Button variant="primary" iconLeft={<Plus size={18} aria-hidden />} onClick={openCreate}>
          Ziel
        </Button>
      </div>

      <GoalSuggestionsCard />

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : !goals || goals.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Target size={18} aria-hidden />}
            text="Noch keine Ziele gesetzt."
            action={
              <Button variant="primary" onClick={openCreate}>
                Ziel anlegen
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {open.length === 0 ? (
            <p className="text-small text-text-faint">Keine offenen Ziele.</p>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {open.map((goal) => (
                <GoalCard key={goal.id} goal={goal} onEdit={openEdit} />
              ))}
            </div>
          )}

          {achieved.length > 0 && (
            <div>
              <h2 className="mb-2 text-h2 text-text">Erreicht</h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {achieved.map((goal) => (
                  <GoalCard key={goal.id} goal={goal} onEdit={openEdit} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <GoalFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} editingGoal={editingGoal} />
    </AppShell>
  );
}

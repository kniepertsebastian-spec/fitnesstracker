import type { GoalDto } from "@fitnesstracker/shared";
import { GOAL_TYPE_LABELS, GOAL_TYPE_UNITS, useDeleteGoal, useUpdateGoal } from "../../hooks/useGoals";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

interface Props {
  goal: GoalDto;
  onEdit: (goal: GoalDto) => void;
}

export function GoalCard({ goal, onEdit }: Props) {
  const updateGoal = useUpdateGoal();
  const deleteGoal = useDeleteGoal();

  const achieved = !!goal.achievedAt;
  const unit = GOAL_TYPE_UNITS[goal.type];
  const progress =
    goal.currentValue !== null ? Math.min(goal.currentValue / goal.targetValue, 1) : null;

  const toggleAchieved = () => {
    updateGoal.mutate({ id: goal.id, input: { achievedAt: achieved ? null : new Date().toISOString() } });
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-text-faint">{GOAL_TYPE_LABELS[goal.type]}</p>
          <p className="truncate font-medium text-text">
            {goal.exerciseName ?? GOAL_TYPE_LABELS[goal.type]}
          </p>
          <p className="text-sm text-text-subtle">
            Ziel: {goal.targetValue} {unit}
            {goal.currentValue !== null && (
              <span className="text-text-faint"> · bisher {goal.currentValue} {unit}</span>
            )}
          </p>
          {goal.targetDate && (
            <p className="text-xs text-text-faint">bis {formatDate(goal.targetDate)}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-2 text-xs">
          <button onClick={() => onEdit(goal)} className="text-text-faint hover:text-accent">
            Bearbeiten
          </button>
          <button
            onClick={() => deleteGoal.mutate(goal.id)}
            className="text-text-faint hover:text-danger-text"
          >
            Löschen
          </button>
        </div>
      </div>

      {progress !== null && !achieved && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-accent" style={{ width: `${progress * 100}%` }} />
        </div>
      )}

      <button
        onClick={toggleAchieved}
        className={`mt-3 w-full rounded-lg py-1.5 text-sm font-medium ${
          achieved
            ? "bg-accent-soft text-accent hover:bg-accent-soft"
            : "bg-surface-2 text-text-muted hover:bg-control"
        }`}
      >
        {achieved ? `✓ Erreicht am ${formatDate(goal.achievedAt as string)}` : "Als erreicht markieren"}
      </button>
    </div>
  );
}

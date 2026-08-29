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
    <div className="rounded-lg border border-ink-800 bg-ink-900 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-ink-500">{GOAL_TYPE_LABELS[goal.type]}</p>
          <p className="truncate font-medium text-ink-100">
            {goal.exerciseName ?? GOAL_TYPE_LABELS[goal.type]}
          </p>
          <p className="text-sm text-ink-400">
            Ziel: {goal.targetValue} {unit}
            {goal.currentValue !== null && (
              <span className="text-ink-500"> · bisher {goal.currentValue} {unit}</span>
            )}
          </p>
          {goal.targetDate && (
            <p className="text-xs text-ink-600">bis {formatDate(goal.targetDate)}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-2 text-xs">
          <button onClick={() => onEdit(goal)} className="text-ink-500 hover:text-violet-400">
            Bearbeiten
          </button>
          <button
            onClick={() => deleteGoal.mutate(goal.id)}
            className="text-ink-600 hover:text-red-400"
          >
            Löschen
          </button>
        </div>
      </div>

      {progress !== null && !achieved && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
          <div className="h-full rounded-full bg-violet-500" style={{ width: `${progress * 100}%` }} />
        </div>
      )}

      <button
        onClick={toggleAchieved}
        className={`mt-3 w-full rounded-lg py-1.5 text-sm font-medium ${
          achieved
            ? "bg-emerald-950 text-emerald-400 hover:bg-emerald-900"
            : "bg-ink-800 text-ink-300 hover:bg-ink-700"
        }`}
      >
        {achieved ? `✓ Erreicht am ${formatDate(goal.achievedAt as string)}` : "Als erreicht markieren"}
      </button>
    </div>
  );
}

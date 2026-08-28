import { Link } from "react-router-dom";
import { GOAL_TYPE_LABELS, GOAL_TYPE_UNITS, useGoals } from "../../hooks/useGoals";

const MAX_VISIBLE = 4;

// Compact "how am I doing" summary on the dashboard — open goals with a slim progress bar, full
// management (edit/delete/mark achieved) stays on /goals. Renders null with no open goals, same
// pattern as DailyChallengeCard/CurrentPlanCard, so an unused feature doesn't take up space.
export function GoalsProgressCard() {
  const { data: goals, isLoading } = useGoals();
  const open = (goals ?? []).filter((g) => !g.achievedAt);

  if (isLoading || open.length === 0) return null;

  const visible = open.slice(0, MAX_VISIBLE);
  const remaining = open.length - visible.length;

  return (
    <div className="rounded-lg border border-ink-800 bg-ink-900 p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-ink-300">Ziele</p>
        <Link to="/goals" className="text-xs text-violet-400 hover:underline">
          Zu den Zielen
        </Link>
      </div>
      <div className="flex flex-col gap-3">
        {visible.map((goal) => {
          const unit = GOAL_TYPE_UNITS[goal.type];
          const progress =
            goal.currentValue !== null ? Math.min(goal.currentValue / goal.targetValue, 1) : null;
          return (
            <div key={goal.id}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-ink-100">
                  {goal.exerciseName ?? GOAL_TYPE_LABELS[goal.type]}
                </span>
                <span className="shrink-0 text-ink-500">
                  {goal.currentValue !== null
                    ? `${goal.currentValue}/${goal.targetValue} ${unit}`
                    : `${goal.targetValue} ${unit}`}
                </span>
              </div>
              {progress !== null && (
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
                  <div
                    className="h-full rounded-full bg-violet-500"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
        {remaining > 0 && (
          <Link to="/goals" className="text-xs text-ink-500 hover:text-ink-300">
            +{remaining} weitere Ziele
          </Link>
        )}
      </div>
    </div>
  );
}

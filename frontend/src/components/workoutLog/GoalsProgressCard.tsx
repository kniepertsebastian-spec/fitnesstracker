import { Link } from "react-router-dom";
import { GOAL_TYPE_LABELS, GOAL_TYPE_UNITS, useGoals } from "../../hooks/useGoals";
import { Card, ProgressBar } from "../ui";

const MAX_VISIBLE = 4;

// Compact "how am I doing" summary — open goals with a slim progress bar, full management
// (edit/delete/mark achieved) stays on /goals. Renders nothing with no open goals.
export function GoalsProgressCard() {
  const { data: goals, isLoading } = useGoals();
  const open = (goals ?? []).filter((g) => !g.achievedAt);

  if (isLoading || open.length === 0) return null;

  const visible = open.slice(0, MAX_VISIBLE);
  const remaining = open.length - visible.length;

  return (
    <Card
      title="Ziele"
      action={
        <Link to="/goals" className="text-small text-accent hover:text-accent-hover">
          Zu den Zielen
        </Link>
      }
    >
      <div className="flex flex-col gap-3">
        {visible.map((goal) => {
          const unit = GOAL_TYPE_UNITS[goal.type];
          const progress = goal.currentValue !== null ? Math.min(goal.currentValue / goal.targetValue, 1) : null;
          const name = goal.exerciseName ?? GOAL_TYPE_LABELS[goal.type];
          return (
            <div key={goal.id}>
              <div className="flex items-center justify-between gap-2 text-body">
                <span className="truncate text-text">{name}</span>
                <span className="tabular shrink-0 text-small text-text-faint">
                  {goal.currentValue !== null ? `${goal.currentValue}/${goal.targetValue} ${unit}` : `${goal.targetValue} ${unit}`}
                </span>
              </div>
              {progress !== null && <ProgressBar className="mt-1.5" value={progress * 100} label={`Ziel ${name}`} />}
            </div>
          );
        })}
        {remaining > 0 && (
          <Link to="/goals" className="text-small text-text-faint hover:text-text-muted">
            +{remaining} weitere Ziele
          </Link>
        )}
      </div>
    </Card>
  );
}

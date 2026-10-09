import { Link } from "react-router-dom";
import { GOAL_TYPE_LABELS, GOAL_TYPE_UNITS, useGoals } from "../../hooks/useGoals";
import { Card, EmptyState, ProgressBar } from "../ui";
import { Target } from "lucide-react";

export function GoalTile() {
  const { data: goals } = useGoals();
  const best = (goals ?? [])
    .filter((g) => !g.achievedAt && g.currentValue !== null && g.targetValue > 0)
    .map((g) => ({ goal: g, progress: Math.min(g.currentValue! / g.targetValue, 1) }))
    .sort((a, b) => b.progress - a.progress)[0];

  return (
    <Card
      title="Nächstes Ziel"
      action={
        <Link to="/goals" className="text-small text-accent hover:text-accent-hover">
          Alle Ziele
        </Link>
      }
    >
      {best ? (
        <>
          <p className="truncate text-body font-medium text-text">
            {best.goal.exerciseName ?? GOAL_TYPE_LABELS[best.goal.type]}
          </p>
          <p className="tabular mt-0.5 text-small text-text-subtle">
            {best.goal.currentValue} / {best.goal.targetValue} {GOAL_TYPE_UNITS[best.goal.type]}
          </p>
          <ProgressBar className="mt-3" value={best.progress * 100} label="Zielfortschritt" />
        </>
      ) : (
        <EmptyState
          className="py-4"
          icon={<Target size={18} aria-hidden />}
          text="Noch kein offenes Ziel."
          action={
            <Link to="/goals" className="text-small text-accent hover:text-accent-hover">
              Ziel anlegen
            </Link>
          }
        />
      )}
    </Card>
  );
}

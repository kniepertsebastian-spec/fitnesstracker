import { Link } from "react-router-dom";
import { TRAINING_PHASE_LABELS, useTrainingPlan } from "../../hooks/useTrainingPlan";
import { usePlanExercises } from "../../hooks/usePlanExercises";

// Shows the exercises assigned to the currently active phase — appears once a plan actually has
// exercises in it, right below the daily challenge card on the log/home page, so "der Plan" is
// visible where the user already checks in every day instead of only on the dedicated /plan page.
export function CurrentPlanCard() {
  const { data: plan } = useTrainingPlan();
  const { data: entries, isLoading } = usePlanExercises(plan?.currentPhase ?? "AUFBAU", {
    enabled: !!plan,
  });

  if (isLoading || !plan || !entries || entries.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-ink-800 bg-ink-900 p-4">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-sm font-medium text-ink-300">
          Trainingsplan · {TRAINING_PHASE_LABELS[plan.currentPhase]}
        </p>
        <Link to="/plan" className="text-xs text-violet-400 hover:underline">
          Zum Plan
        </Link>
      </div>

      <div className="mt-2 flex flex-col gap-1.5">
        {entries.map((entry) => (
          <div key={entry.id} className="flex items-center justify-between gap-2">
            <Link
              to={`/exercises/${entry.exerciseId}`}
              className="truncate text-sm text-ink-200 hover:underline"
            >
              {entry.exerciseName}
            </Link>
            {(entry.targetSets || entry.targetReps) && (
              <span className="shrink-0 text-sm text-ink-500">
                {entry.targetSets ?? "?"} × {entry.targetReps ?? "?"}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

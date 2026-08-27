import { Link } from "react-router-dom";
import { TRAINING_PHASE_LABELS, useTrainingPlan } from "../../hooks/useTrainingPlan";
import { useWeeklyPlanStatus } from "../../hooks/usePlanExercises";

// Shows today's workout on the log/home page — for a multi-day split (Push/Pull/Legs etc.) that
// means one day at a time, progressing to the next day once the current one has been trained
// this week (Mon-Sun), and resetting to day 1 every Monday. A single-day ("Ganzkörper") plan or
// a plan with no day grouping at all just shows its flat exercise list, same as before this
// feature existed — see planWeekStatus.service.ts for where the progression is computed.
export function CurrentPlanCard() {
  const { data: plan } = useTrainingPlan();
  const { data: status, isLoading } = useWeeklyPlanStatus(plan?.currentPhase ?? "AUFBAU", {
    enabled: !!plan,
  });

  if (isLoading || !plan || !status || status.days.length === 0) {
    return null;
  }

  const isSplit = status.days.length > 1;
  const activeDay = status.activeDayIndex !== null ? status.days[status.activeDayIndex] : null;

  return (
    <div className="rounded-lg border border-ink-800 bg-ink-900 p-4">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-sm font-medium text-ink-300">
          Trainingsplan · {TRAINING_PHASE_LABELS[plan.currentPhase]}
          {activeDay?.dayLabel && ` · ${activeDay.dayLabel}`}
        </p>
        <Link to="/plan" className="text-xs text-violet-400 hover:underline">
          Zum Plan
        </Link>
      </div>

      {isSplit && (
        <div className="mt-2 flex gap-1">
          {status.days.map((day, index) => (
            <span
              key={index}
              title={day.dayLabel ?? undefined}
              className={`h-1.5 flex-1 rounded-full ${
                day.completed
                  ? "bg-emerald-500"
                  : index === status.activeDayIndex
                    ? "bg-violet-500"
                    : "bg-ink-800"
              }`}
            />
          ))}
        </div>
      )}

      {activeDay ? (
        <div className="mt-2 flex flex-col gap-1.5">
          {activeDay.exercises.map((entry) => (
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
      ) : (
        <p className="mt-3 text-sm text-emerald-400">
          Alle Trainingstage dieser Woche abgeschlossen — ab Montag geht's mit Tag 1 weiter. 🎉
        </p>
      )}
    </div>
  );
}

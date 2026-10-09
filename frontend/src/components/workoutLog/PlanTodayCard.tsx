import { useState } from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { TRAINING_PHASE_LABELS, useTrainingPlan } from "../../hooks/useTrainingPlan";
import { useWeeklyPlanStatus } from "../../hooks/usePlanExercises";
import { useOpenWorkoutSession } from "../../hooks/useWorkoutSession";
import { useWorkoutLogs } from "../../hooks/useWorkoutLogs";
import { isToday } from "../../lib/dates";
import { ButtonLink, Card, ListRow, SegmentedControl } from "../ui";

// Today's plan as list rows (name, planned sets × reps, sets logged today). Logging itself
// happens in the focus mode (/training) — the diary keeps freely logging and correcting sets.
export function PlanTodayCard() {
  const { data: plan } = useTrainingPlan();
  const { data: status } = useWeeklyPlanStatus(plan?.currentPhase ?? "AUFBAU", { enabled: !!plan });
  const { data: logs } = useWorkoutLogs();
  const { data: session } = useOpenWorkoutSession();
  const [selected, setSelected] = useState<number | null>(null);

  if (!plan || !status || status.days.length === 0) return null;

  const index = Math.min(selected ?? status.activeDayIndex ?? 0, status.days.length - 1);
  const day = status.days[index];
  const todays = (logs ?? []).filter((l) => isToday(l.performedAt));

  return (
    <Card
      title={`Plan · ${TRAINING_PHASE_LABELS[plan.currentPhase]}`}
      action={
        <Link to="/plan" className="text-small text-accent hover:text-accent-hover">
          Zum Plan
        </Link>
      }
    >
      {status.days.length > 1 && (
        <SegmentedControl
          label="Trainingstag"
          className="mb-2"
          value={String(index)}
          onChange={(v) => setSelected(Number(v))}
          options={status.days.map((d, i) => ({
            value: String(i),
            label: (
              <span className="flex items-center gap-1">
                Tag {i + 1}
                {d.completed && <Check size={14} aria-label="erledigt" />}
              </span>
            ),
          }))}
        />
      )}
      {day.dayLabel && <p className="mb-1 text-small text-text-subtle">{day.dayLabel}</p>}
      <div>
        {day.exercises.map((e, i) => {
          const done = todays.filter((l) => l.exerciseId === e.exerciseId).length;
          const planned = e.targetSets ?? 3;
          return (
            <ListRow key={e.id} prefix={i + 1} value={`${planned} × ${e.targetReps ?? "–"}`}>
              <div className="flex items-center justify-between gap-2">
                <Link to={`/exercises/${e.exerciseId}`} className="min-w-0 truncate hover:text-accent">
                  {e.exerciseName}
                </Link>
                <span className="tabular shrink-0 text-small text-text-faint">
                  {done > 0 ? `${done} von ${planned} heute` : e.loggedThisWeek ? "diese Woche erledigt" : ""}
                </span>
              </div>
            </ListRow>
          );
        })}
      </div>
      <ButtonLink to="/training" variant={session ? "secondary" : "primary"} className="mt-3" fullWidth>
        {session ? "Training fortsetzen" : "Im Fokusmodus trainieren"}
      </ButtonLink>
    </Card>
  );
}

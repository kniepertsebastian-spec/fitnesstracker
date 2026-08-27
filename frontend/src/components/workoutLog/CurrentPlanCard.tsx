import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { PlanDiaryExerciseDto } from "@fitnesstracker/shared";
import { TRAINING_PHASE_LABELS, useTrainingPlan } from "../../hooks/useTrainingPlan";
import { useWeeklyPlanStatus } from "../../hooks/usePlanExercises";
import { useCreateWorkoutLog } from "../../hooks/useWorkoutLogs";

interface DiaryRowProps {
  entry: PlanDiaryExerciseDto;
  setsInputRef: (el: HTMLInputElement | null) => void;
  onDone: () => void;
}

// One row of the plan diary: sets/reps/weight as plain number inputs, "Ende" as a checkbox.
// Checking it writes one WorkoutLog per set entered (this *is* how the diary counts as a real
// training-log entry, not just a plan-side checkbox) and locks the row — unchecking is
// deliberately not supported, so a fumbled tap can't create duplicate sets; mistakes get fixed
// via the existing edit/delete controls on the log table below, same as any other logged set.
function DiaryRow({ entry, setsInputRef, onDone }: DiaryRowProps) {
  const createLog = useCreateWorkoutLog();
  const [sets, setSets] = useState("3");
  const [reps, setReps] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [done, setDone] = useState(entry.loggedThisWeek);
  const [error, setError] = useState(false);

  if (done) {
    return (
      <tr className="border-b border-ink-900">
        <td className="py-2 pr-2 text-ink-500 line-through decoration-ink-700">{entry.exerciseName}</td>
        <td colSpan={3} className="py-2 text-center text-xs text-ink-600">
          erledigt
        </td>
        <td className="py-2 text-center text-emerald-400">✓</td>
      </tr>
    );
  }

  const handleCheck = async (checked: boolean) => {
    if (!checked) return;
    const setsNum = Number(sets);
    const repsNum = Number(reps);
    const weightNum = Number(weightKg);
    if (
      !Number.isInteger(setsNum) ||
      setsNum <= 0 ||
      !Number.isInteger(repsNum) ||
      repsNum <= 0 ||
      !Number.isFinite(weightNum) ||
      weightNum < 0
    ) {
      setError(true);
      return;
    }
    setError(false);
    for (let setNumber = 1; setNumber <= setsNum; setNumber++) {
      await createLog.mutateAsync({
        input: {
          clientId: crypto.randomUUID(),
          exerciseId: entry.exerciseId,
          setNumber,
          reps: repsNum,
          weightKg: weightNum,
        },
        exerciseName: entry.exerciseName,
      });
    }
    setDone(true);
    onDone();
  };

  return (
    <>
      <tr className={error ? "" : "border-b border-ink-900"}>
        <td className="max-w-[88px] truncate py-2 pr-1 text-sm text-ink-100">{entry.exerciseName}</td>
        <td className="py-2 pr-1">
          <input
            ref={setsInputRef}
            type="number"
            min={1}
            value={sets}
            onChange={(e) => setSets(e.target.value)}
            className="w-9 rounded border border-ink-700 bg-ink-950 px-1 py-1 text-center text-sm"
          />
        </td>
        <td className="py-2 pr-1">
          <input
            type="number"
            min={1}
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            className="w-9 rounded border border-ink-700 bg-ink-950 px-1 py-1 text-center text-sm"
          />
        </td>
        <td className="py-2 pr-1">
          <input
            type="number"
            min={0}
            step="0.5"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            className="w-11 rounded border border-ink-700 bg-ink-950 px-1 py-1 text-center text-sm"
          />
        </td>
        <td className="py-2 text-center">
          <input
            type="checkbox"
            disabled={createLog.isPending}
            onChange={(e) => handleCheck(e.target.checked)}
            className="h-4 w-4 accent-emerald-500"
          />
        </td>
      </tr>
      {error && (
        <tr className="border-b border-ink-900">
          <td colSpan={5} className="pb-2 text-xs text-red-400">
            Sätze/Wdh./kg ausfüllen
          </td>
        </tr>
      )}
    </>
  );
}

// Today's workout as a fillable diary, driven by the active split day — for a multi-day split
// that's one day at a time (see planWeekStatus.service.ts for the progressive unlock), for a
// single-day ("Ganzkörper") plan just that day's exercises. Filling in a row and checking "Ende"
// writes real WorkoutLog entries, so this doubles as the actual training log for that session,
// not a separate checklist next to it.
export function CurrentPlanCard() {
  const { data: plan } = useTrainingPlan();
  const { data: status, isLoading } = useWeeklyPlanStatus(plan?.currentPhase ?? "AUFBAU", {
    enabled: !!plan,
  });
  const rowRefs = useRef<(HTMLInputElement | null)[]>([]);

  if (isLoading || !plan || !status || status.days.length === 0) {
    return null;
  }

  const isSplit = status.days.length > 1;
  const activeDay = status.activeDayIndex !== null ? status.days[status.activeDayIndex] : null;

  const focusNext = (index: number) => {
    rowRefs.current[index + 1]?.focus();
  };

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
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink-800 text-left text-xs text-ink-500">
                <th className="pb-1 pr-1 font-medium">Übung</th>
                <th className="pb-1 pr-1 font-medium">Sätze</th>
                <th className="pb-1 pr-1 font-medium">Wdh.</th>
                <th className="pb-1 pr-1 font-medium">kg</th>
                <th className="pb-1 font-medium">Ende</th>
              </tr>
            </thead>
            <tbody>
              {activeDay.exercises.map((entry, index) => (
                <DiaryRow
                  key={entry.id}
                  entry={entry}
                  setsInputRef={(el) => (rowRefs.current[index] = el)}
                  onDone={() => focusNext(index)}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 text-sm text-emerald-400">
          Alle Trainingstage dieser Woche abgeschlossen — ab Montag geht's mit Tag 1 weiter. 🎉
        </p>
      )}
    </div>
  );
}

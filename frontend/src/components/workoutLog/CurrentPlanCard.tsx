import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { PlanDiaryExerciseDto, ProgressionSuggestion } from "@fitnesstracker/shared";
import { TRAINING_PHASE_LABELS, useTrainingPlan } from "../../hooks/useTrainingPlan";
import { useWeeklyPlanStatus } from "../../hooks/usePlanExercises";
import { useCreateWorkoutLog, useWorkoutLogs } from "../../hooks/useWorkoutLogs";
import { usePRToastStore } from "../../stores/prToastStore";
import { detectPRs, prLabels } from "../../lib/prDetection";

interface DiaryRowProps {
  entry: PlanDiaryExerciseDto;
  firstSetInputRef: (el: HTMLInputElement | null) => void;
  onDone: () => void;
}

interface SetValues {
  reps: string;
  weightKg: string;
}

// Text + color for the progression subtitle under the exercise name — see
// planWeekStatus.service.ts's computeProgression for the underlying rules (roadmap2.md P0.3).
// Deload takes priority over the mode-specific hit/miss wording since it overrides both the
// suggested weight and (in reps mode) resets the rep target back to baseline.
function progressionHint(p: ProgressionSuggestion): { text: string; className: string } {
  if (p.deloadSuggested) {
    return { text: `Deload → ${p.suggestedWeightKg}kg`, className: "text-amber-400" };
  }
  if (p.mode === "weight") {
    return p.hitTarget
      ? { text: `↑ ${p.suggestedWeightKg}kg`, className: "text-emerald-400" }
      : { text: `= ${p.suggestedWeightKg}kg`, className: "text-ink-500" };
  }
  return p.hitTarget
    ? { text: `↑ ${p.suggestedReps} Wdh.`, className: "text-emerald-400" }
    : { text: `= ${p.suggestedReps} Wdh.`, className: "text-ink-500" };
}

// One row of the plan diary: sets/reps/weight as plain number inputs, "Ende" as a checkbox.
// Checking it writes one WorkoutLog per set entered (this *is* how the diary counts as a real
// training-log entry, not just a plan-side checkbox) and locks the row — unchecking is
// deliberately not supported, so a fumbled tap can't create duplicate sets; mistakes get fixed
// via the existing edit/delete controls on the log table below, same as any other logged set.
function DiaryRow({ entry, firstSetInputRef, onDone }: DiaryRowProps) {
  const createLog = useCreateWorkoutLog();
  const { data: allLogs } = useWorkoutLogs();
  const showPR = usePRToastStore((s) => s.showPR);
  const initialReps = entry.progression
    ? String(entry.progression.suggestedReps)
    : entry.targetReps
      ? String(entry.targetReps)
      : "";
  const initialWeight = entry.progression ? String(entry.progression.suggestedWeightKg) : "";
  const initialSetCount = entry.targetSets ?? 3;
  const [setValues, setSetValues] = useState<SetValues[]>(() =>
    Array.from({ length: initialSetCount }, () => ({ reps: initialReps, weightKg: initialWeight })),
  );
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
    const parsedSets = setValues.map((set) => ({
      reps: Number(set.reps),
      weightKg: Number(set.weightKg),
    }));
    if (parsedSets.some((set) =>
      !Number.isInteger(set.reps) ||
      set.reps <= 0 ||
      !Number.isFinite(set.weightKg) ||
      set.weightKg < 0
    )) {
      setError(true);
      return;
    }
    setError(false);
    // Captured once before the batch — checking all setsNum sets at once against a baseline
    // that's already absorbed some of them would understate what this batch actually achieved.
    const performedAt = new Date().toISOString();
    const prs = detectPRs(
      allLogs ?? [],
      entry.exerciseId,
      parsedSets.map((set) => ({ ...set, performedAt })),
    );
    for (const [index, set] of parsedSets.entries()) {
      await createLog.mutateAsync({
        input: {
          clientId: crypto.randomUUID(),
          exerciseId: entry.exerciseId,
          setNumber: index + 1,
          reps: set.reps,
          weightKg: set.weightKg,
        },
        exerciseName: entry.exerciseName,
      });
    }
    if (prLabels(prs).length > 0) {
      showPR(entry.exerciseName, prLabels(prs));
    }
    setDone(true);
    onDone();
  };

  const changeSetCount = (rawCount: string) => {
    const count = Number(rawCount);
    if (!Number.isInteger(count) || count < 1 || count > 20) return;
    setSetValues((current) => {
      if (count <= current.length) return current.slice(0, count);
      const template = current.at(-1) ?? { reps: initialReps, weightKg: initialWeight };
      return [...current, ...Array.from({ length: count - current.length }, () => ({ ...template }))];
    });
  };

  const updateSet = (index: number, field: keyof SetValues, value: string) => {
    setSetValues((current) =>
      current.map((set, setIndex) => setIndex === index ? { ...set, [field]: value } : set),
    );
  };

  return (
    <>
      <tr className={error ? "" : "border-b border-ink-900"}>
        <td className="max-w-[88px] py-2 pr-1">
          <p className="truncate text-sm text-ink-100">{entry.exerciseName}</p>
          {entry.progression && (
            <p className={`text-xs ${progressionHint(entry.progression).className}`}>
              {progressionHint(entry.progression).text}
            </p>
          )}
        </td>
        <td className="py-2 pr-1">
          <input
            type="number"
            min={1}
            max={20}
            value={setValues.length}
            onChange={(e) => changeSetCount(e.target.value)}
            className="w-9 rounded border border-ink-700 bg-ink-950 px-1 py-1 text-center text-sm"
          />
        </td>
        <td className="py-2 pr-1 align-top">
          <div className="flex flex-col gap-1">
            {setValues.map((set, index) => (
              <input
                key={index}
                ref={index === 0 ? firstSetInputRef : undefined}
                aria-label={`Satz ${index + 1}: Wiederholungen`}
                type="number"
                min={1}
                value={set.reps}
                onChange={(e) => updateSet(index, "reps", e.target.value)}
                className="w-9 rounded border border-ink-700 bg-ink-950 px-1 py-1 text-center text-sm"
              />
            ))}
          </div>
        </td>
        <td className="py-2 pr-1 align-top">
          <div className="flex flex-col gap-1">
            {setValues.map((set, index) => (
              <input
                key={index}
                aria-label={`Satz ${index + 1}: Gewicht`}
                type="number"
                min={0}
                step="0.5"
                value={set.weightKg}
                onChange={(e) => updateSet(index, "weightKg", e.target.value)}
                className="w-14 rounded border border-ink-700 bg-ink-950 px-1 py-1 text-center text-sm"
              />
            ))}
          </div>
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
// not a separate checklist next to it. The "Tag N" tabs are a manual day switcher — the
// auto-detected active day is just the default, not a hard rail; someone who wants to jump to
// day 2 or 3 without day 1 being complete (for whatever reason) can just tap the tab.
export function CurrentPlanCard() {
  const { data: plan } = useTrainingPlan();
  const { data: status, isLoading } = useWeeklyPlanStatus(plan?.currentPhase ?? "AUFBAU", {
    enabled: !!plan,
  });
  const rowRefs = useRef<(HTMLInputElement | null)[]>([]);
  // Overrides the auto-detected active day once someone taps a different day's tab — e.g.
  // skipping ahead to day 2 or 3 without day 1 being marked complete first, for whatever reason.
  // `null` means "no manual override yet", so a fresh page load still starts on the
  // auto-detected day; once set, it sticks even if activeDayIndex later changes (logging a set
  // shouldn't yank the view back out from under someone mid-fill).
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);

  if (isLoading || !plan || !status || status.days.length === 0) {
    return null;
  }

  const isSplit = status.days.length > 1;
  const displayIndex =
    selectedDayIndex !== null
      ? Math.min(selectedDayIndex, status.days.length - 1)
      : status.activeDayIndex;
  const activeDay = displayIndex !== null ? status.days[displayIndex] : null;

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
        <div className="mt-2 flex gap-1 rounded-lg border border-ink-800 bg-ink-950 p-1">
          {status.days.map((day, index) => (
            <button
              key={index}
              onClick={() => setSelectedDayIndex(index)}
              title={day.dayLabel ?? undefined}
              className={`flex flex-1 items-center justify-center gap-1 rounded-md py-1.5 text-sm font-medium ${
                index === displayIndex
                  ? "bg-violet-500 text-ink-950"
                  : "text-ink-400 hover:text-ink-200"
              }`}
            >
              Tag {index + 1}
              {day.completed && <span className="text-emerald-500">✓</span>}
            </button>
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
                  firstSetInputRef={(el) => (rowRefs.current[index] = el)}
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

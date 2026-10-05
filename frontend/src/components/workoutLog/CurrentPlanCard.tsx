import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { PlanDiaryExerciseDto, ProgressionSuggestion } from "@fitnesstracker/shared";
import { TRAINING_PHASE_LABELS, useTrainingPlan } from "../../hooks/useTrainingPlan";
import { useWeeklyPlanStatus } from "../../hooks/usePlanExercises";
import { useCreateWorkoutLog, useDeleteWorkoutLog, useWorkoutLogs } from "../../hooks/useWorkoutLogs";
import { usePRToastStore } from "../../stores/prToastStore";
import { useTimerStore } from "../../stores/timerStore";
import { unlockAudio } from "../../lib/timerSound";
import { detectPRs, prLabels } from "../../lib/prDetection";

interface DiaryRowProps {
  entry: PlanDiaryExerciseDto;
  firstSetInputRef: (el: HTMLInputElement | null) => void;
  onDone: () => void;
}

interface SetValues {
  reps: string;
  weightKg: string;
  // clientId of the WorkoutLog written when this set was ticked off, null while still open.
  clientId: string | null;
}

// Monday 00:00 UTC of the current week — same boundary planWeekStatus.service.ts uses for
// "trained this week", so reopening a finished row finds exactly the logs that marked it done.
function currentWeekStartMs() {
  const now = new Date();
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const daysSinceMonday = day.getUTCDay() === 0 ? 6 : day.getUTCDay() - 1;
  day.setUTCDate(day.getUTCDate() - daysSinceMonday);
  return day.getTime();
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

// One row of the plan diary: sets/reps/weight as plain number inputs. Each set has its own
// checkbox — ticking it writes that set as a real WorkoutLog right away and starts the rest
// timer, unticking deletes the log again, so a fumbled tap is reversible. "Übung abschließen"
// (or ticking the last open set) collapses the row; "Rückgängig" reopens it, and the set count
// stays editable either way (removing a ticked set deletes its log).
function DiaryRow({ entry, firstSetInputRef, onDone }: DiaryRowProps) {
  const createLog = useCreateWorkoutLog();
  const deleteLog = useDeleteWorkoutLog();
  const { data: allLogs } = useWorkoutLogs();
  const showPR = usePRToastStore((s) => s.showPR);
  const { autoStartEnabled, autoStartSeconds, start: startRestTimer } = useTimerStore();
  const initialReps = entry.progression
    ? String(entry.progression.suggestedReps)
    : entry.targetReps
      ? String(entry.targetReps)
      : "";
  const initialWeight = entry.progression ? String(entry.progression.suggestedWeightKg) : "";
  const initialSetCount = entry.targetSets ?? 3;
  const [setValues, setSetValues] = useState<SetValues[]>(() =>
    Array.from({ length: initialSetCount }, () => ({
      reps: initialReps,
      weightKg: initialWeight,
      clientId: null,
    })),
  );
  const [done, setDone] = useState(entry.loggedThisWeek);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const parseSet = (set: SetValues) => ({ reps: Number(set.reps), weightKg: Number(set.weightKg) });
  const isValid = (set: { reps: number; weightKg: number }) =>
    Number.isInteger(set.reps) && set.reps > 0 && Number.isFinite(set.weightKg) && set.weightKg >= 0;

  // Writes the given sets as logs (PR check against the baseline captured once up front, so a
  // batch isn't compared against itself) and returns the new clientIds by set index.
  const logSets = async (indexes: number[]): Promise<Map<number, string> | null> => {
    const parsed = indexes.map((index) => parseSet(setValues[index]));
    if (!parsed.every(isValid)) {
      setError(true);
      return null;
    }
    setError(false);
    const performedAt = new Date().toISOString();
    const prs = detectPRs(
      allLogs ?? [],
      entry.exerciseId,
      parsed.map((set) => ({ ...set, performedAt })),
    );
    const ids = new Map<number, string>();
    for (const [i, index] of indexes.entries()) {
      const clientId = crypto.randomUUID();
      await createLog.mutateAsync({
        input: {
          clientId,
          exerciseId: entry.exerciseId,
          setNumber: index + 1,
          reps: parsed[i].reps,
          weightKg: parsed[i].weightKg,
        },
        exerciseName: entry.exerciseName,
      });
      ids.set(index, clientId);
    }
    if (prLabels(prs).length > 0) showPR(entry.exerciseName, prLabels(prs));
    return ids;
  };

  const applyIds = (ids: Map<number, string>) =>
    setSetValues((current) =>
      current.map((set, index) => (ids.has(index) ? { ...set, clientId: ids.get(index)! } : set)),
    );

  const finish = () => {
    setDone(true);
    onDone();
  };

  const toggleSet = async (index: number, checked: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      const current = setValues[index];
      if (checked) {
        const ids = await logSets([index]);
        if (!ids) return;
        applyIds(ids);
        unlockAudio();
        if (autoStartEnabled) {
          startRestTimer(autoStartSeconds, `${entry.exerciseName} · Satz ${index + 1} fertig`);
        }
        if (setValues.every((set, i) => i === index || set.clientId !== null)) finish();
      } else if (current.clientId) {
        await deleteLog.mutateAsync(current.clientId);
        setSetValues((values) =>
          values.map((set, i) => (i === index ? { ...set, clientId: null } : set)),
        );
      }
    } finally {
      setBusy(false);
    }
  };

  // Logs every set that isn't ticked yet in one go (the old one-tap behaviour), then collapses.
  const handleFinish = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const open = setValues.flatMap((set, index) => (set.clientId === null ? [index] : []));
      if (open.length > 0) {
        const ids = await logSets(open);
        if (!ids) return;
        applyIds(ids);
      }
      finish();
    } finally {
      setBusy(false);
    }
  };

  // Reopens a finished row. After a reload the local set state knows nothing about what was
  // logged, so rebuild it from this week's logs for the exercise.
  const handleUndo = () => {
    if (!setValues.some((set) => set.clientId !== null)) {
      const weekStart = currentWeekStartMs();
      const logged = (allLogs ?? [])
        .filter((log) => log.exerciseId === entry.exerciseId && Date.parse(log.performedAt) >= weekStart)
        .sort((a, b) => a.setNumber - b.setNumber || (a.performedAt < b.performedAt ? -1 : 1));
      if (logged.length > 0) {
        setSetValues(
          logged.map((log) => ({
            reps: String(log.reps),
            weightKg: String(log.weightKg),
            clientId: log.clientId,
          })),
        );
      }
    }
    setDone(false);
  };

  if (done) {
    return (
      <tr className="border-b border-ink-900">
        <td className="py-2 pr-2 text-ink-500 line-through decoration-ink-700">
          <Link to={`/exercises/${entry.exerciseId}`} className="hover:underline">
            {entry.exerciseName}
          </Link>
        </td>
        <td colSpan={3} className="py-2 text-center text-xs text-ink-600">
          erledigt
        </td>
        <td className="py-2 text-center">
          <button
            onClick={handleUndo}
            aria-label={`${entry.exerciseName}: Rückgängig`}
            className="rounded bg-ink-800 px-2 py-1 text-xs text-ink-200 hover:bg-ink-700"
          >
            ↩
          </button>
        </td>
      </tr>
    );
  }

  const changeSetCount = async (count: number) => {
    if (busy || !Number.isInteger(count) || count < 1 || count > 20 || count === setValues.length) return;
    if (count < setValues.length) {
      setBusy(true);
      try {
        const removed = setValues.slice(count).flatMap((set) => (set.clientId ? [set.clientId] : []));
        for (const clientId of removed) await deleteLog.mutateAsync(clientId);
      } finally {
        setBusy(false);
      }
      // Only 3 of 4 sets done: dropping the 4th leaves nothing open, so the exercise is complete
      // — no need to fill in dummy values for a set that never happened.
      if (setValues.slice(0, count).every((set) => set.clientId !== null)) {
        setSetValues((current) => current.slice(0, count));
        finish();
        return;
      }
    }
    setSetValues((current) => {
      if (count <= current.length) return current.slice(0, count);
      const template = current.at(-1) ?? { reps: initialReps, weightKg: initialWeight };
      return [
        ...current,
        ...Array.from({ length: count - current.length }, () => ({
          reps: template.reps,
          weightKg: template.weightKg,
          clientId: null,
        })),
      ];
    });
  };

  const updateSet = (index: number, field: "reps" | "weightKg", value: string) => {
    setSetValues((current) =>
      current.map((set, setIndex) => (setIndex === index ? { ...set, [field]: value } : set)),
    );
  };

  return (
    <>
      <tr className="border-b-0">
        <td className="max-w-[88px] py-2 pr-1 align-top">
          <Link
            to={`/exercises/${entry.exerciseId}`}
            className="block truncate text-sm text-ink-100 underline decoration-ink-700 underline-offset-2 hover:text-violet-400"
          >
            {entry.exerciseName}
          </Link>
          {entry.progression && (
            <p className={`text-xs ${progressionHint(entry.progression).className}`}>
              {progressionHint(entry.progression).text}
            </p>
          )}
        </td>
        <td className="py-2 pr-1 align-top">
          <div className="flex flex-col items-center gap-1" aria-label="Anzahl Sätze">
            <button
              onClick={() => void changeSetCount(setValues.length + 1)}
              disabled={busy || setValues.length >= 20}
              aria-label="Satz hinzufügen"
              className="h-7 w-7 rounded bg-ink-800 text-sm text-ink-200 hover:bg-ink-700 disabled:opacity-40"
            >
              +
            </button>
            <span className="text-sm text-ink-100">{setValues.length}</span>
            <button
              onClick={() => void changeSetCount(setValues.length - 1)}
              disabled={busy || setValues.length <= 1}
              aria-label="Satz entfernen"
              className="h-7 w-7 rounded bg-ink-800 text-sm text-ink-200 hover:bg-ink-700 disabled:opacity-40"
            >
              −
            </button>
          </div>
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
        <td className="py-2 text-center align-top">
          <div className="flex flex-col gap-1">
            {setValues.map((set, index) => (
              <label key={index} className="flex h-[30px] items-center justify-center">
                <input
                  type="checkbox"
                  aria-label={`Satz ${index + 1}: fertig`}
                  checked={set.clientId !== null}
                  disabled={busy}
                  onChange={(e) => void toggleSet(index, e.target.checked)}
                  className="h-5 w-5 accent-emerald-500"
                />
              </label>
            ))}
          </div>
        </td>
      </tr>
      <tr className={error ? "" : "border-b border-ink-900"}>
        <td colSpan={5} className="pb-2 text-right">
          <button
            onClick={() => void handleFinish()}
            disabled={busy}
            className="rounded bg-ink-800 px-2 py-1 text-xs text-ink-200 hover:bg-ink-700 disabled:opacity-50"
          >
            Übung abschließen
          </button>
        </td>
      </tr>
      {error && (
        <tr className="border-b border-ink-900">
          <td colSpan={5} className="pb-2 text-xs text-red-400">
            Wdh./kg ausfüllen
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
                <th className="pb-1 font-medium">Fertig</th>
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

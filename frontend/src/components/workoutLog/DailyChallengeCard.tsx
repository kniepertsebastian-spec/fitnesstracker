import { useState } from "react";
import { Link } from "react-router-dom";
import type { DailyChallengeCategory } from "@fitnesstracker/shared";
import { ApiError } from "../../api/client";
import { useAddChallengeReps, useDailyChallenge, useRerollChallengeItem } from "../../hooks/useDailyChallenge";

const QUICK_ADD = [1, 5, 10];

const CATEGORY_LABELS: Record<DailyChallengeCategory, string> = {
  TECHNIQUE: "Technik",
  PROGRESSION: "Progression",
  VOLUME: "Volumen",
  CONSISTENCY: "Konsistenz",
  RECOVERY: "Erholung",
};

export function DailyChallengeCard() {
  const { data: items, isLoading } = useDailyChallenge();
  const addReps = useAddChallengeReps();
  const reroll = useRerollChallengeItem();
  const [rerollError, setRerollError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-ink-800 bg-ink-900 p-4">
        <p className="text-sm text-ink-500">Tages-Challenge lädt…</p>
      </div>
    );
  }

  if (!items || items.length === 0) {
    return null;
  }

  const handleReroll = (itemId: string) => {
    setRerollError(null);
    reroll.mutate(itemId, {
      onError: (error) => {
        setRerollError(error instanceof ApiError ? error.message : "Rotation fehlgeschlagen");
      },
    });
  };

  return (
    <div className="rounded-lg border border-ink-800 bg-ink-900 p-4">
      <p className="mb-1 text-sm font-medium text-ink-300">Tages-Challenge</p>
      <p className="mb-3 text-xs text-ink-500">Passend zu deinem aktuellen Trainingsplan.</p>

      <div className="flex flex-col gap-3">
        {items.map((item) => {
          const progress = Math.min(item.completedReps / item.targetReps, 1);
          const done = item.completedReps >= item.targetReps;
          const isRerolling = reroll.isPending && reroll.variables === item.id;
          return (
            <div key={item.id}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 rounded bg-ink-800 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-500">
                    {CATEGORY_LABELS[item.category]}
                  </span>
                  <Link to={`/exercises/${item.exerciseId}`} className="truncate text-sm text-ink-200 hover:underline">
                    {item.exerciseName}
                  </Link>
                </div>
                <span className={`shrink-0 text-sm font-medium ${done ? "text-emerald-400" : "text-violet-400"}`}>
                  {item.completedReps}/{item.targetReps}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
                <div
                  className={`h-full rounded-full ${done ? "bg-emerald-500" : "bg-violet-500"}`}
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                {QUICK_ADD.map((n) => (
                  <button
                    key={n}
                    onClick={() => addReps.mutate({ itemId: item.id, delta: n })}
                    className="rounded-lg bg-ink-800 px-2 py-1 text-xs text-ink-200 hover:bg-ink-700"
                  >
                    +{n}
                  </button>
                ))}
                {item.rotationsRemaining > 0 && (
                  <button
                    onClick={() => handleReroll(item.id)}
                    disabled={isRerolling}
                    title={`Übung tauschen (${item.rotationsRemaining} von 2 übrig)`}
                    className="ml-auto rounded-lg px-2 py-1 text-xs text-ink-500 hover:bg-ink-800 hover:text-ink-300 disabled:opacity-50"
                  >
                    {isRerolling ? "…" : "🔀 tauschen"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {rerollError && <p className="mt-2 text-xs text-red-400">{rerollError}</p>}
    </div>
  );
}

import { Link } from "react-router-dom";
import { useAddChallengeReps, useDailyChallenge } from "../../hooks/useDailyChallenge";

const QUICK_ADD = [1, 5, 10];

export function DailyChallengeCard() {
  const { data: items, isLoading } = useDailyChallenge();
  const addReps = useAddChallengeReps();

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

  return (
    <div className="rounded-lg border border-ink-800 bg-ink-900 p-4">
      <p className="mb-1 text-sm font-medium text-ink-300">Tages-Challenge</p>
      <p className="mb-3 text-xs text-ink-500">Ohne Geräte, überall machbar.</p>

      <div className="flex flex-col gap-3">
        {items.map((item) => {
          const progress = Math.min(item.completedReps / item.targetReps, 1);
          const done = item.completedReps >= item.targetReps;
          return (
            <div key={item.id}>
              <div className="flex items-center justify-between">
                <Link to={`/exercises/${item.exerciseId}`} className="text-sm text-ink-200 hover:underline">
                  {item.exerciseName}
                </Link>
                <span className={`text-sm font-medium ${done ? "text-emerald-400" : "text-violet-400"}`}>
                  {item.completedReps}/{item.targetReps}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
                <div
                  className={`h-full rounded-full ${done ? "bg-emerald-500" : "bg-violet-500"}`}
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              <div className="mt-1.5 flex gap-2">
                {QUICK_ADD.map((n) => (
                  <button
                    key={n}
                    onClick={() => addReps.mutate({ itemId: item.id, delta: n })}
                    className="rounded-lg bg-ink-800 px-2 py-1 text-xs text-ink-200 hover:bg-ink-700"
                  >
                    +{n}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

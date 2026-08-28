import { useBodyCompositionEntries } from "../../hooks/useBodyComposition";
import { rangeCutoff, type ProgressRange } from "../../lib/progressRange";
import { Sparkline } from "./Sparkline";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

// Neutral ↑/↓/→ like BodyCompositionCard's trendArrow — deliberately no "up is bad, down is good"
// color coding: a weight increase is exactly the goal for some users, so the direction alone
// can't be judged good or bad here.
function trendArrow(delta: number): string {
  if (delta > 0) return "↑";
  if (delta < 0) return "↓";
  return "→";
}

export function WeightProgressCard({ range }: { range: ProgressRange }) {
  const { data: entries, isLoading } = useBodyCompositionEntries();

  if (isLoading) return null;

  const cutoff = rangeCutoff(range);
  // API returns entries newest-first — reverse to chronological order for the chart/first-vs-last
  // comparison below.
  const inRange = (entries ?? [])
    .filter((e) => !cutoff || new Date(e.measuredAt) >= cutoff)
    .slice()
    .reverse();

  return (
    <div className="rounded-lg border border-ink-800 bg-ink-900 p-4">
      <p className="mb-1 text-sm font-medium text-ink-300">Gewicht &amp; Körperdaten</p>

      {inRange.length === 0 ? (
        <p className="mt-2 text-sm text-ink-500">Keine Messungen in diesem Zeitraum.</p>
      ) : (
        <>
          {(() => {
            const first = inRange[0];
            const last = inRange[inRange.length - 1];
            const delta = last.weightKg - first.weightKg;
            return (
              <>
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-lg font-semibold text-ink-100">{last.weightKg} kg</p>
                  {inRange.length > 1 && (
                    <p className="text-sm text-ink-500">
                      {trendArrow(delta)} {Math.abs(delta).toFixed(1)} kg seit {formatDate(first.measuredAt)}
                    </p>
                  )}
                </div>
                <Sparkline values={inRange.map((e) => e.weightKg)} />
                {last.bodyFatPercent !== null && (
                  <p className="mt-3 text-sm text-ink-400">
                    Körperfett: <span className="text-violet-400">{last.bodyFatPercent}%</span>
                  </p>
                )}
              </>
            );
          })()}
        </>
      )}
    </div>
  );
}

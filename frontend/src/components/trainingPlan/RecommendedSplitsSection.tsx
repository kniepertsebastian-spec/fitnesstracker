import { useState } from "react";
import { RECOMMENDED_SPLITS } from "../../data/recommendedSplits";

export function RecommendedSplitsSection() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div>
      <h2 className="mb-2 text-sm font-medium text-ink-400">Empfohlene Trainingspläne</h2>
      <div className="flex flex-col gap-2">
        {RECOMMENDED_SPLITS.map((split) => {
          const expanded = expandedId === split.id;
          return (
            <div key={split.id} className="rounded-lg border border-ink-800 bg-ink-900 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-ink-100">{split.title}</p>
                  <p className="text-sm text-ink-500">{split.description}</p>
                </div>
                <button
                  onClick={() => setExpandedId(expanded ? null : split.id)}
                  aria-label={expanded ? "Einklappen" : "Übungen anzeigen"}
                  aria-expanded={expanded}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-ink-700 text-ink-300 hover:bg-ink-800 hover:text-ink-100"
                >
                  {expanded ? "−" : "+"}
                </button>
              </div>

              {expanded && (
                <div className="mt-3 flex flex-col gap-3 border-t border-ink-800 pt-3">
                  {split.days.map((day) => (
                    <div key={day.label}>
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-500">
                        {day.label}
                      </p>
                      <ul className="flex flex-col gap-1">
                        {day.exercises.map((exercise) => (
                          <li key={exercise} className="text-sm text-ink-300">
                            {exercise}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { RECOMMENDED_SPLITS } from "../../data/recommendedSplits";
import { Card, IconButton } from "../ui";

export function RecommendedSplitsSection() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <Card title="Empfohlene Trainingspläne">
      <div className="flex flex-col">
        {RECOMMENDED_SPLITS.map((split) => {
          const expanded = expandedId === split.id;
          return (
            <div key={split.id} className="border-t border-border-subtle py-3 first:border-t-0 first:pt-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-body font-medium text-text">{split.title}</p>
                  <p className="text-small text-text-subtle">{split.description}</p>
                </div>
                <IconButton
                  aria-label={expanded ? `${split.title} einklappen` : `${split.title}: Übungen anzeigen`}
                  aria-expanded={expanded}
                  onClick={() => setExpandedId(expanded ? null : split.id)}
                >
                  {expanded ? <Minus size={16} aria-hidden /> : <Plus size={16} aria-hidden />}
                </IconButton>
              </div>

              {expanded && (
                <div className="mt-3 flex flex-col gap-3 rounded-lg bg-surface-2 p-3">
                  {split.days.map((day) => (
                    <div key={day.label}>
                      <p className="mb-1 text-overline uppercase text-text-faint">{day.label}</p>
                      <ul className="flex flex-col gap-1">
                        {day.exercises.map((exercise) => (
                          <li key={exercise} className="text-small text-text-2">
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
    </Card>
  );
}

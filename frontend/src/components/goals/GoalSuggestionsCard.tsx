import { useState } from "react";
import type { GoalSuggestionDto } from "@fitnesstracker/shared";
import { useCreateGoal, useGoalSuggestions } from "../../hooks/useGoals";

type Tier = "conservative" | "realistic" | "ambitious";

const TIER_LABELS: Record<Tier, string> = {
  conservative: "Konservativ",
  realistic: "Realistisch",
  ambitious: "Ambitioniert",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function unit(type: GoalSuggestionDto["type"]) {
  return type === "REPS" ? "Wdh." : "kg";
}

function SuggestionRow({ suggestion }: { suggestion: GoalSuggestionDto }) {
  const createGoal = useCreateGoal();
  const [tier, setTier] = useState<Tier>("realistic");
  const selected = suggestion.tiers[tier];

  return (
    <div className="rounded-lg border border-ink-800 bg-ink-900 p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-ink-100">{suggestion.exerciseName}</p>
          <p className="text-xs text-ink-500">
            bisher {suggestion.currentBestValue} {unit(suggestion.type)}
          </p>
        </div>
        {suggestion.plateauDetected && (
          <span
            className="shrink-0 rounded-full bg-amber-950 px-1.5 py-0.5 text-[10px] text-amber-400"
            title="Kein neuer Bestwert in den letzten 3 Trainingseinheiten — Vorschläge deshalb vorsichtiger"
          >
            Stagniert
          </span>
        )}
      </div>

      <div className="mb-2 flex gap-1 rounded-lg border border-ink-800 bg-ink-950 p-1">
        {(Object.keys(TIER_LABELS) as Tier[]).map((t) => (
          <button
            key={t}
            onClick={() => setTier(t)}
            className={`flex-1 rounded-md py-1 text-xs font-medium ${
              tier === t ? "bg-violet-500 text-ink-950" : "text-ink-400"
            }`}
          >
            {TIER_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-ink-400">
          Ziel: {selected.targetValue} {unit(suggestion.type)}
          <span className="text-ink-600"> · bis {formatDate(selected.targetDate)}</span>
        </p>
        <button
          onClick={() =>
            createGoal.mutate({
              type: suggestion.type,
              exerciseId: suggestion.exerciseId,
              targetValue: selected.targetValue,
              targetDate: selected.targetDate,
            })
          }
          disabled={createGoal.isPending}
          className="shrink-0 rounded-lg bg-violet-500 px-3 py-1.5 text-sm font-medium text-ink-950 hover:bg-violet-400 disabled:opacity-50"
        >
          Übernehmen
        </button>
      </div>
    </div>
  );
}

// Data-driven suggestions (roadmap "additionals" P1.5): each exercise's own recent progression
// rate, training frequency, rep range, volume trend, plateau state, and the user's own track
// record of hitting past deadlines feed into three ambition tiers per exercise — see
// goalSuggestion.service.ts for the full rule set. Rule-based throughout, no AI involved.
export function GoalSuggestionsCard() {
  const { data: suggestions, isLoading } = useGoalSuggestions();

  if (isLoading || !suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <div className="mb-4">
      <h2 className="mb-2 text-sm font-medium text-ink-400">Vorschläge</h2>
      <div className="flex flex-col gap-2">
        {suggestions.map((suggestion) => (
          <SuggestionRow key={suggestion.exerciseId} suggestion={suggestion} />
        ))}
      </div>
    </div>
  );
}

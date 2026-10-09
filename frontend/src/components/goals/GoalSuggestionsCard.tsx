import { useState } from "react";
import type { GoalSuggestionDto } from "@fitnesstracker/shared";
import { useCreateGoal, useGoalSuggestions } from "../../hooks/useGoals";
import { Badge, Button, Card, SegmentedControl } from "../ui";

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
    <Card>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-body font-medium text-text">{suggestion.exerciseName}</p>
          <p className="tabular text-small text-text-faint">
            bisher {suggestion.currentBestValue} {unit(suggestion.type)}
          </p>
        </div>
        {suggestion.plateauDetected && (
          <Badge
            tone="warning"
            title="Kein neuer Bestwert in den letzten 3 Trainingseinheiten — Vorschläge deshalb vorsichtiger"
          >
            Plateau
          </Badge>
        )}
      </div>

      <SegmentedControl
        label={`Stufe für ${suggestion.exerciseName}`}
        className="mb-3"
        value={tier}
        onChange={setTier}
        options={(Object.keys(TIER_LABELS) as Tier[]).map((t) => ({ value: t, label: TIER_LABELS[t] }))}
      />

      <div className="flex items-center justify-between gap-3">
        <p className="tabular text-small text-text-subtle">
          Ziel: {selected.targetValue} {unit(suggestion.type)}
          <span className="text-text-faint"> · bis {formatDate(selected.targetDate)}</span>
        </p>
        <Button
          variant="primary"
          disabled={createGoal.isPending}
          onClick={() =>
            createGoal.mutate({
              type: suggestion.type,
              exerciseId: suggestion.exerciseId,
              targetValue: selected.targetValue,
              targetDate: selected.targetDate,
            })
          }
        >
          Übernehmen
        </Button>
      </div>
    </Card>
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
      <h2 className="mb-2 text-h2 text-text">Vorschläge</h2>
      <div className="grid gap-3 lg:grid-cols-2">
        {suggestions.map((suggestion) => (
          <SuggestionRow key={suggestion.exerciseId} suggestion={suggestion} />
        ))}
      </div>
    </div>
  );
}

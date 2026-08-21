import { useCreateGoal, useGoalSuggestions } from "../../hooks/useGoals";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function GoalSuggestionsCard() {
  const { data: suggestions, isLoading } = useGoalSuggestions();
  const createGoal = useCreateGoal();

  if (isLoading || !suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <div className="mb-4">
      <h2 className="mb-2 text-sm font-medium text-ink-400">Vorschläge</h2>
      <div className="flex flex-col gap-2">
        {suggestions.map((suggestion) => (
          <div
            key={suggestion.exerciseId}
            className="flex items-center justify-between gap-2 rounded-lg border border-ink-800 bg-ink-900 p-3"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-ink-100">{suggestion.exerciseName}</p>
              <p className="text-sm text-ink-400">
                Ziel: {suggestion.suggestedTargetKg} kg
                <span className="text-ink-500"> · bisher {suggestion.currentBestKg} kg</span>
              </p>
              <p className="text-xs text-ink-600">bis {formatDate(suggestion.suggestedTargetDate)}</p>
            </div>
            <button
              onClick={() =>
                createGoal.mutate({
                  type: "WEIGHT",
                  exerciseId: suggestion.exerciseId,
                  targetValue: suggestion.suggestedTargetKg,
                  targetDate: suggestion.suggestedTargetDate,
                })
              }
              disabled={createGoal.isPending}
              className="shrink-0 rounded-lg bg-violet-500 px-3 py-1.5 text-sm font-medium text-ink-950 hover:bg-violet-400 disabled:opacity-50"
            >
              Übernehmen
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

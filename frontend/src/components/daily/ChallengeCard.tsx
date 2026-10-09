import { useState } from "react";
import { Link } from "react-router-dom";
import { Shuffle } from "lucide-react";
import { ApiError } from "../../api/client";
import { useAddChallengeReps, useDailyChallenge, useRerollChallengeItem } from "../../hooks/useDailyChallenge";
import { useWorkoutLogs } from "../../hooks/useWorkoutLogs";
import { CHALLENGE_CATEGORIES, challengeReason } from "../../lib/challenge";
import { Badge, Button, Callout, Card, IconButton, ProgressBar, SegmentedProgress, SetCheck, Skeleton } from "../ui";
import type { SegmentState } from "../ui";

const QUICK_ADD = [1, 5, 10];

export function ChallengeCard() {
  const { data: items, isLoading } = useDailyChallenge();
  const { data: logs } = useWorkoutLogs();
  const addReps = useAddChallengeReps();
  const reroll = useRerollChallengeItem();
  const [error, setError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <Card title="Tages-Challenge">
        <Skeleton className="h-40 w-full" />
      </Card>
    );
  }
  if (!items || items.length === 0) return null;

  const segments: SegmentState[] = items.map((i) => (i.completedReps >= i.targetReps ? "done" : "open"));
  const doneCount = segments.filter((s) => s === "done").length;

  const handleReroll = (itemId: string) => {
    setError(null);
    reroll.mutate(itemId, {
      onError: (e) => setError(e instanceof ApiError ? e.message : "Tauschen fehlgeschlagen"),
    });
  };

  return (
    <Card
      title="Tages-Challenge"
      action={<span className="tabular text-small text-text-subtle">{doneCount} von {items.length}</span>}
    >
      <SegmentedProgress segments={segments} size={8} label="Tages-Challenge" className="mb-4" />

      <div className="flex flex-col gap-3">
        {items.map((item) => {
          const done = item.completedReps >= item.targetReps;
          const cat = CHALLENGE_CATEGORIES[item.category];
          const swapping = reroll.isPending && reroll.variables === item.id;
          return (
            <div key={item.id} className="rounded-xl border border-border bg-surface-2 p-3">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <Badge tone={cat.tone}>{cat.label}</Badge>
                  <Link
                    to={`/exercises/${item.exerciseId}`}
                    className="mt-1.5 block truncate text-body font-medium text-text hover:text-accent"
                  >
                    {item.exerciseName}
                  </Link>
                  <p className="text-small text-text-subtle">
                    <span className="tabular font-mono text-text-2">{item.targetReps} Wdh.</span> ·{" "}
                    {challengeReason(item, logs ?? [])}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {item.rotationsRemaining > 0 && (
                    <IconButton
                      aria-label={`${item.exerciseName} tauschen (${item.rotationsRemaining}× möglich)`}
                      title={`${item.rotationsRemaining}× tauschen`}
                      disabled={swapping}
                      onClick={() => handleReroll(item.id)}
                    >
                      <Shuffle size={18} strokeWidth={1.8} aria-hidden />
                    </IconButton>
                  )}
                  <SetCheck
                    state={done ? "done" : "open"}
                    aria-label={done ? `${item.exerciseName} zurücksetzen` : `${item.exerciseName} abhaken`}
                    onClick={() =>
                      addReps.mutate({
                        itemId: item.id,
                        delta: done ? -item.completedReps : item.targetReps - item.completedReps,
                      })
                    }
                  />
                </div>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <ProgressBar
                  value={(item.completedReps / item.targetReps) * 100}
                  size={6}
                  label={`${item.exerciseName}: ${item.completedReps} von ${item.targetReps}`}
                />
                <span className="tabular shrink-0 font-mono text-small text-text-2">
                  {item.completedReps}/{item.targetReps}
                </span>
              </div>
              {!done && (
                <div className="mt-2 flex gap-2">
                  {QUICK_ADD.map((n) => (
                    <Button
                      key={n}
                      size="sm"
                      variant="secondary"
                      onClick={() => addReps.mutate({ itemId: item.id, delta: n })}
                    >
                      +{n}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <Callout tone="danger" className="mt-3">
          {error}
        </Callout>
      )}
      <p className="mt-3 text-xs text-text-faint">Aus deinem aktuellen Plan · je Übung zweimal tauschbar</p>
    </Card>
  );
}

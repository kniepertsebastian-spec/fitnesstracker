import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ExerciseOptionDto } from "@fitnesstracker/shared";
import { listExercisesRequest } from "../../api/exercise.api";
import { useSyncStore } from "../../stores/syncStore";
import { Dialog, Input, SegmentedControl, cn } from "../ui";

export type EditScope = "today" | "plan";

interface Props {
  open: boolean;
  title: string;
  description?: string;
  options: ExerciseOptionDto[];
  // The plan's own alternative for the exercise, marked as such.
  recommendedId?: string | null;
  scope: EditScope;
  onScopeChange: (scope: EditScope) => void;
  onPick: (option: { exerciseId: string; exerciseName: string }) => void;
  onClose: () => void;
}

const SCOPE_OPTIONS = [
  { value: "today" as const, label: "Nur heute" },
  { value: "plan" as const, label: "Dauerhaft im Plan" },
];

// Picks an exercise to swap in or add during a workout. The suggestions ship with the weekly
// plan (same muscle, allowed equipment) and so work offline; the free search needs a connection.
export function ExercisePickerDialog({ open, title, description, options, recommendedId, scope, onScopeChange, onPick, onClose }: Props) {
  const [search, setSearch] = useState("");
  const isOnline = useSyncStore((s) => s.isOnline);
  const query = search.trim();
  const { data: results, isFetching } = useQuery({
    queryKey: ["exercise-search", query],
    queryFn: () => listExercisesRequest({ search: query, pageSize: 30 }).then((r) => r.items),
    enabled: open && isOnline && query.length >= 2,
    staleTime: 60_000,
  });

  const pick = (exerciseId: string, exerciseName: string) => {
    onPick({ exerciseId, exerciseName });
    setSearch("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setSearch("");
          onClose();
        }
      }}
      title={title}
      description={description}
    >
      <div className="flex flex-col gap-4">
        <SegmentedControl label="Gültigkeit der Änderung" value={scope} onChange={onScopeChange} options={SCOPE_OPTIONS} />

        {options.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-small font-medium text-text-muted">Vorschläge</p>
            {options.map((o) => (
              <OptionButton
                key={o.exerciseId}
                name={o.exerciseName}
                meta={[o.exerciseId === recommendedId ? "Alternative aus dem Plan" : null, o.equipment].filter(Boolean).join(" · ")}
                onClick={() => pick(o.exerciseId, o.exerciseName)}
              />
            ))}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Input
            aria-label="Übung suchen"
            placeholder={isOnline ? "Andere Übung suchen…" : "Suche nur mit Internet möglich"}
            disabled={!isOnline}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {query.length >= 2 && isFetching && <p className="text-xs text-text-subtle">Sucht…</p>}
          {results?.map((r) => (
            <OptionButton
              key={r.id}
              name={r.name}
              meta={[r.equipment, r.primaryMuscles[0]].filter(Boolean).join(" · ")}
              onClick={() => pick(r.id, r.name)}
            />
          ))}
          {query.length >= 2 && results?.length === 0 && <p className="text-xs text-text-subtle">Keine Übung gefunden.</p>}
        </div>
      </div>
    </Dialog>
  );
}

function OptionButton({ name, meta, onClick }: { name: string; meta: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-12 flex-col justify-center rounded-lg border border-border-strong px-3 py-2 text-left",
        "transition-colors duration-150 hover:bg-surface-2",
      )}
    >
      <span className="text-body text-text">{name}</span>
      {meta && <span className="text-xs text-text-subtle">{meta}</span>}
    </button>
  );
}

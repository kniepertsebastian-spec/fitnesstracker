import { useState } from "react";
import { Check, Pencil, Trash2 } from "lucide-react";
import type { GoalDto } from "@fitnesstracker/shared";
import { GOAL_TYPE_LABELS, GOAL_TYPE_UNITS, useDeleteGoal, useUpdateGoal } from "../../hooks/useGoals";
import { Button, Card, Dialog, IconButton, ProgressBar } from "../ui";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

interface Props {
  goal: GoalDto;
  onEdit: (goal: GoalDto) => void;
}

export function GoalCard({ goal, onEdit }: Props) {
  const updateGoal = useUpdateGoal();
  const deleteGoal = useDeleteGoal();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const achieved = !!goal.achievedAt;
  const unit = GOAL_TYPE_UNITS[goal.type];
  const name = goal.exerciseName ?? GOAL_TYPE_LABELS[goal.type];
  const progress = goal.currentValue !== null ? Math.min(goal.currentValue / goal.targetValue, 1) : null;

  const toggleAchieved = () => {
    updateGoal.mutate({ id: goal.id, input: { achievedAt: achieved ? null : new Date().toISOString() } });
  };

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-text-faint">{GOAL_TYPE_LABELS[goal.type]}</p>
          <p className="truncate text-body font-medium text-text">{name}</p>
          <p className="tabular text-small text-text-subtle">
            Ziel: {goal.targetValue} {unit}
            {goal.currentValue !== null && (
              <span className="text-text-faint">
                {" "}
                · bisher {goal.currentValue} {unit}
              </span>
            )}
          </p>
          {goal.targetDate && <p className="text-xs text-text-faint">bis {formatDate(goal.targetDate)}</p>}
        </div>
        <div className="flex shrink-0">
          <IconButton aria-label={`${name} bearbeiten`} className="border-transparent bg-transparent" onClick={() => onEdit(goal)}>
            <Pencil size={16} aria-hidden />
          </IconButton>
          <IconButton
            aria-label={`${name} löschen`}
            className="border-transparent bg-transparent hover:text-danger-text"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 size={16} aria-hidden />
          </IconButton>
        </div>
      </div>

      {progress !== null && !achieved && (
        <ProgressBar className="mt-3" value={progress * 100} label={`Fortschritt ${name}`} />
      )}

      <Button
        variant={achieved ? "secondary" : "ghost"}
        fullWidth
        className={achieved ? "mt-3 text-accent" : "mt-3"}
        iconLeft={achieved ? <Check size={16} aria-hidden /> : undefined}
        disabled={updateGoal.isPending}
        onClick={toggleAchieved}
      >
        {achieved ? `Erreicht am ${formatDate(goal.achievedAt as string)}` : "Als erreicht markieren"}
      </Button>

      <Dialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Ziel löschen?"
        description={`${name} · ${goal.targetValue} ${unit}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Abbrechen
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                deleteGoal.mutate(goal.id);
                setConfirmDelete(false);
              }}
            >
              Löschen
            </Button>
          </>
        }
      >
        <p className="text-small text-text-subtle">Das lässt sich nicht rückgängig machen.</p>
      </Dialog>
    </Card>
  );
}

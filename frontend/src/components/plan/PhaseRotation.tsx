import { useState } from "react";
import { CalendarCheck, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import {
  TRAINING_PHASE_ROTATION,
  type PhaseConfigItem,
  type TrainingPhase,
} from "@fitnesstracker/shared";
import {
  TRAINING_PHASE_LABELS,
  useAddTrainingPhase,
  useDeleteTrainingPhase,
  useRenameTrainingPhase,
} from "../../hooks/useTrainingPlan";
import { PHASE_DOT, PHASE_RULES } from "../../lib/phaseInfo";
import { Badge, Button, Callout, Dialog, Field, IconButton, Input, cn } from "../ui";

interface Props {
  current: TrainingPhase;
  selected: TrainingPhase;
  phases?: PhaseConfigItem[];
  onSelect: (phase: TrainingPhase) => void;
}

export function PhaseRotation({ current, selected, phases, onSelect }: Props) {
  const addPhase = useAddTrainingPhase();
  const renamePhase = useRenameTrainingPhase();
  const deletePhase = useDeleteTrainingPhase();

  const [addDialog, setAddDialog] = useState<{ open: boolean; isDaily: boolean }>({
    open: false,
    isDaily: false,
  });
  const [newLabel, setNewLabel] = useState("");
  const [renameTarget, setRenameTarget] = useState<PhaseConfigItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<PhaseConfigItem | null>(null);

  const items: PhaseConfigItem[] =
    phases && phases.length > 0
      ? phases
      : TRAINING_PHASE_ROTATION.map((phase) => ({
          phase,
          label: TRAINING_PHASE_LABELS[phase],
          isDaily: false,
        }));

  const rotationalItems = items.filter((i) => !i.isDaily);
  const dailyItem = items.find((i) => i.isDaily || i.phase === "DAILY") ?? null;
  const canAddRotational = rotationalItems.length < 8;

  const handleOpenAdd = (isDaily: boolean) => {
    setNewLabel(isDaily ? "Daily Routine" : "");
    setAddDialog({ open: true, isDaily });
  };

  const handleCreate = () => {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    addPhase.mutate(
      { label: trimmed, isDaily: addDialog.isDaily },
      {
        onSuccess: (updatedPlan) => {
          setAddDialog({ open: false, isDaily: false });
          setNewLabel("");
          const created = updatedPlan.phases[updatedPlan.phases.length - 1];
          if (created) onSelect(created.phase);
        },
      },
    );
  };

  const handleRename = () => {
    if (!renameTarget) return;
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    renamePhase.mutate(
      { phase: renameTarget.phase, input: { label: trimmed } },
      {
        onSuccess: () => {
          setRenameTarget(null);
          setRenameValue("");
        },
      },
    );
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    const deletedPhase = deleteTarget.phase;
    deletePhase.mutate(deletedPhase, {
      onSuccess: (updatedPlan) => {
        setDeleteTarget(null);
        if (selected === deletedPhase) {
          onSelect(updatedPlan.currentPhase);
        }
      },
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-small font-medium text-text-subtle">Trainingsphasen &amp; Fokus</span>
        <div className="flex flex-wrap items-center gap-2">
          {!dailyItem && (
            <Button
              size="sm"
              variant="secondary"
              iconLeft={<CalendarCheck size={14} aria-hidden />}
              onClick={() => handleOpenAdd(true)}
            >
              + Daily-Phase
            </Button>
          )}
          {canAddRotational && (
            <Button
              size="sm"
              variant="dashed"
              iconLeft={<Plus size={14} aria-hidden />}
              onClick={() => handleOpenAdd(false)}
            >
              + Phase hinzufügen
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-stretch" role="radiogroup" aria-label="Phase wählen">
        {rotationalItems.map((item, i) => (
          <div key={item.phase} className="flex min-w-[210px] flex-1 items-center gap-2">
            <div
              className={cn(
                "relative flex min-h-[76px] flex-1 items-start justify-between gap-2 rounded-xl border p-3 text-left transition-colors duration-150",
                selected === item.phase
                  ? "border-accent-border bg-surface-2"
                  : "border-border bg-surface hover:bg-surface-2",
              )}
            >
              <button
                type="button"
                role="radio"
                aria-checked={selected === item.phase}
                onClick={() => onSelect(item.phase)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="flex items-center gap-2">
                  <span aria-hidden className={cn("h-2.5 w-2.5 shrink-0 rounded-full", PHASE_DOT[item.phase])} />
                  <span className="truncate text-body font-semibold text-text">{item.label}</span>
                  {item.phase === current && <span className="shrink-0 text-xs text-text-subtle">· aktuell</span>}
                </span>
                <span className="mt-1 block text-small text-text-subtle">
                  {PHASE_RULES[item.phase]}
                </span>
              </button>

              <div className="flex shrink-0 items-center gap-0.5">
                <IconButton
                  aria-label={`${item.label} umbenennen`}
                  className="h-8 w-8 border-transparent bg-transparent text-text-subtle hover:text-text"
                  onClick={() => {
                    setRenameTarget(item);
                    setRenameValue(item.label);
                  }}
                >
                  <Pencil size={14} aria-hidden />
                </IconButton>
                {rotationalItems.length > 1 && (
                  <IconButton
                    aria-label={`${item.label} löschen`}
                    className="h-8 w-8 border-transparent bg-transparent text-text-subtle hover:text-danger-text"
                    onClick={() => setDeleteTarget(item)}
                  >
                    <Trash2 size={14} aria-hidden />
                  </IconButton>
                )}
              </div>
            </div>

            {i < rotationalItems.length - 1 && (
              <ChevronRight size={16} aria-hidden className="hidden shrink-0 text-text-faint lg:block" />
            )}
          </div>
        ))}
      </div>

      {dailyItem && (
        <div
          className={cn(
            "flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors duration-150",
            selected === dailyItem.phase
              ? "border-accent-border bg-surface-2"
              : "border-border bg-surface hover:bg-surface-2",
          )}
        >
          <button
            type="button"
            role="radio"
            aria-checked={selected === dailyItem.phase}
            onClick={() => onSelect(dailyItem.phase)}
            className="min-w-0 flex-1 text-left"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full bg-magenta" />
              <span className="text-body font-semibold text-text">{dailyItem.label}</span>
              <Badge tone="magenta">Daily · berührt deinen Rotationsplan nicht</Badge>
            </div>
            <span className="mt-1 block text-small text-text-subtle">
              Tägliche Übungen &amp; Routinen separat verwalten, ohne deine aktuelle Trainingsphase zu ändern.
            </span>
          </button>

          <div className="flex shrink-0 items-center gap-0.5">
            <IconButton
              aria-label={`${dailyItem.label} umbenennen`}
              className="h-8 w-8 border-transparent bg-transparent text-text-subtle hover:text-text"
              onClick={() => {
                setRenameTarget(dailyItem);
                setRenameValue(dailyItem.label);
              }}
            >
              <Pencil size={14} aria-hidden />
            </IconButton>
            <IconButton
              aria-label={`${dailyItem.label} löschen`}
              className="h-8 w-8 border-transparent bg-transparent text-text-subtle hover:text-danger-text"
              onClick={() => setDeleteTarget(dailyItem)}
            >
              <Trash2 size={14} aria-hidden />
            </IconButton>
          </div>
        </div>
      )}

      {/* Dialog: Phase hinzufügen / Daily erstellen */}
      <Dialog
        open={addDialog.open}
        onOpenChange={(open) => setAddDialog((prev) => ({ ...prev, open }))}
        title={addDialog.isDaily ? "Daily-Trainingsphase erstellen" : "Neue Trainingsphase hinzufügen"}
        description={
          addDialog.isDaily
            ? "Die Daily-Phase läuft komplett unabhängig neben deinem regulären Trainingsplan. Deine aktuelle Phase und die 8-Wochen-Rotation bleiben unverändert."
            : "Die neue Phase wird an deine Rotation angehängt und kann sofort mit eigenen Übungen befüllt werden."
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddDialog({ open: false, isDaily: false })}>
              Abbrechen
            </Button>
            <Button
              variant="primary"
              disabled={!newLabel.trim() || addPhase.isPending}
              onClick={handleCreate}
            >
              {addDialog.isDaily ? "Daily-Phase erstellen" : "Phase hinzufügen"}
            </Button>
          </>
        }
      >
        <Field label="Name der Phase" hint="Maximal 40 Zeichen (z. B. Maximalkraft, Deload, Daily Core).">
          {(p) => (
            <Input
              {...p}
              value={newLabel}
              maxLength={40}
              placeholder={addDialog.isDaily ? "Daily Routine" : "z. B. Maximalkraft"}
              onChange={(e) => setNewLabel(e.target.value)}
            />
          )}
        </Field>
        {addPhase.isError && (
          <Callout tone="danger" className="mt-3">
            Phase konnte nicht erstellt werden.
          </Callout>
        )}
      </Dialog>

      {/* Dialog: Phase umbenennen */}
      <Dialog
        open={renameTarget !== null}
        onOpenChange={(open) => !open && setRenameTarget(null)}
        title="Trainingsphase umbenennen"
        description="Alle zugewiesenen Übungen und der bisherige Trainingsverlauf bleiben vollständig erhalten."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenameTarget(null)}>
              Abbrechen
            </Button>
            <Button
              variant="primary"
              disabled={!renameValue.trim() || renamePhase.isPending}
              onClick={handleRename}
            >
              Speichern
            </Button>
          </>
        }
      >
        <Field label="Neuer Name">
          {(p) => (
            <Input
              {...p}
              value={renameValue}
              maxLength={40}
              onChange={(e) => setRenameValue(e.target.value)}
            />
          )}
        </Field>
        {renamePhase.isError && (
          <Callout tone="danger" className="mt-3">
            Phase konnte nicht umbenannt werden.
          </Callout>
        )}
      </Dialog>

      {/* Dialog: Phase löschen */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Phase „${deleteTarget?.label ?? ""}“ löschen?`}
        description="Die Phase und ihre hinterlegten Plan-Übungen werden entfernt. Deine bereits geloggten Sätze im Fitnesstagebuch bleiben selbstverständlich erhalten."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Abbrechen
            </Button>
            <Button
              variant="danger"
              disabled={deletePhase.isPending}
              onClick={handleDelete}
            >
              Endgültig löschen
            </Button>
          </>
        }
      >
        {deletePhase.isError && (
          <Callout tone="danger">
            Phase konnte nicht gelöscht werden.
          </Callout>
        )}
      </Dialog>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  CARDIO_MACHINE_LABELS,
  CARDIO_SLOT_LABELS,
  type CardioMachine,
  type CardioPlanItem,
  type CardioSlot,
} from "@fitnesstracker/shared";
import { ApiError } from "../../api/client";
import { Button, Callout, Dialog, Field, IconButton, Input, Select, Stepper } from "../ui";

const MACHINES = Object.keys(CARDIO_MACHINE_LABELS) as CardioMachine[];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Slots that can be added: WARMUP/AFTER for a training day, FREE for the free days. */
  slots: CardioSlot[];
  initial: CardioPlanItem[];
  saving: boolean;
  onSave: (items: CardioPlanItem[]) => Promise<unknown>;
}

const DEFAULTS: Record<CardioSlot, CardioPlanItem> = {
  WARMUP: { slot: "WARMUP", machine: "TREADMILL", durationMinutes: 5, intensity: "locker" },
  AFTER: { slot: "AFTER", machine: "BIKE", durationMinutes: 15, intensity: "Zone 2 · locker" },
  FREE: { slot: "FREE", machine: "TREADMILL", durationMinutes: 30, intensity: "Zone 2 · gleichmäßig" },
};

export function CardioEditDialog({ open, onOpenChange, title, description, slots, initial, saving, onSave }: Props) {
  const [items, setItems] = useState<CardioPlanItem[]>(initial);
  const [error, setError] = useState<string | null>(null);

  // Start from the current plan every time the dialog opens, not from an abandoned edit — only on
  // the closed→open transition, so a refetch while editing can't wipe the edits.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setItems(initial);
      setError(null);
    }
    wasOpen.current = open;
  }, [open, initial]);

  const update = (index: number, patch: Partial<CardioPlanItem>) =>
    setItems((list) => list.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const save = async () => {
    if (items.some((i) => i.intensity.trim() === "")) return setError("Bitte bei jeder Einheit die Intensität angeben.");
    setError(null);
    try {
      await onSave(items.map((i) => ({ ...i, intensity: i.intensity.trim() })));
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Speichern fehlgeschlagen. Plan-Änderungen brauchen eine Verbindung.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <div className="flex flex-col gap-3">
        {items.length === 0 && <p className="text-small text-text-subtle">Keine Cardio-Einheit. Füge unten eine hinzu.</p>}
        {items.map((item, index) => (
          <fieldset key={index} className="flex flex-col gap-3 rounded-lg border border-border bg-surface-2 p-3">
            <legend className="sr-only">Einheit {index + 1}</legend>
            <div className="flex items-center gap-2">
              {slots.length > 1 ? (
                <Select
                  aria-label="Zeitpunkt"
                  value={item.slot}
                  onChange={(e) => update(index, { slot: e.target.value as CardioSlot })}
                  className="w-auto"
                >
                  {slots.map((s) => (
                    <option key={s} value={s}>
                      {CARDIO_SLOT_LABELS[s]}
                    </option>
                  ))}
                </Select>
              ) : (
                <span className="text-small font-medium text-text-subtle">Einheit {index + 1}</span>
              )}
              <IconButton
                aria-label={`Einheit ${index + 1} entfernen`}
                className="ml-auto hover:text-danger-text"
                onClick={() => setItems((list) => list.filter((_, i) => i !== index))}
              >
                <Trash2 size={16} aria-hidden />
              </IconButton>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Gerät">
                {(p) => (
                  <Select {...p} value={item.machine} onChange={(e) => update(index, { machine: e.target.value as CardioMachine })}>
                    {MACHINES.map((m) => (
                      <option key={m} value={m}>
                        {CARDIO_MACHINE_LABELS[m]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <div className="flex flex-col gap-1.5">
                <span className="text-small font-medium text-text-muted">Dauer</span>
                <Stepper
                  label="Dauer"
                  unit="Min."
                  min={1}
                  max={180}
                  step={5}
                  value={item.durationMinutes}
                  onChange={(v) => update(index, { durationMinutes: Math.max(1, v) })}
                />
              </div>
            </div>
            <Field label="Intensität" hint="z. B. Zone 2, 120 W, 8 × 30 s zügig / 90 s locker">
              {(p) => (
                <Input {...p} maxLength={80} value={item.intensity} onChange={(e) => update(index, { intensity: e.target.value })} />
              )}
            </Field>
          </fieldset>
        ))}

        <div className="flex flex-wrap gap-2">
          {slots.map((s) => (
            <Button
              key={s}
              size="sm"
              variant="dashed"
              iconLeft={<Plus size={14} aria-hidden />}
              onClick={() => setItems((list) => [...list, { ...DEFAULTS[s] }])}
            >
              {s === "FREE" ? "Einheit" : CARDIO_SLOT_LABELS[s]}
            </Button>
          ))}
        </div>

        {error && <Callout tone="danger">{error}</Callout>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button variant="primary" disabled={saving} onClick={() => void save()}>
            Speichern
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

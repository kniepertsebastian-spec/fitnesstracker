import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { CardioMachine, CreateCardioLogInput } from "@fitnesstracker/shared";
import { ApiError } from "../../api/client";
import { useCreateCardioLog, useDeleteCardioLog, useWeekCardioLogs } from "../../hooks/useCardioLogs";
import { Badge, Button, Callout, Card, Dialog, EmptyState, Field, IconButton, Input, ListRow, Select, StatTile } from "../ui";
import { Activity } from "lucide-react";
import { utcDayKey } from "../../lib/dates";

const MACHINE_LABELS: Record<CardioMachine, string> = {
  TREADMILL: "Laufband",
  BIKE: "Fahrrad",
  STEPPER: "Stepper",
  STAIRMASTER: "Stairmaster",
};
const MACHINES = Object.keys(MACHINE_LABELS) as CardioMachine[];

function CardioForm({ onClose }: { onClose: () => void }) {
  const create = useCreateCardioLog();
  const [machine, setMachine] = useState<CardioMachine>("TREADMILL");
  const [level, setLevel] = useState("");
  const [intensity, setIntensity] = useState("");
  const [minutes, setMinutes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const levelValue = level.trim() === "" ? null : Number(level);
    const duration = Number(minutes);
    if (levelValue !== null && (!Number.isInteger(levelValue) || levelValue <= 0)) return setError("Stufe muss eine ganze Zahl sein.");
    if (!Number.isInteger(duration) || duration <= 0) return setError("Bitte die Zeit in ganzen Minuten angeben.");
    if (!intensity.trim()) return setError("Bitte die Intensität angeben.");
    setError(null);
    const input: CreateCardioLogInput = { machine, level: levelValue, intensity: intensity.trim(), durationMinutes: duration };
    try {
      await create.mutateAsync(input);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Speichern fehlgeschlagen.");
    }
  };

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Field label="Gerät">
        {(p) => (
          <Select {...p} value={machine} onChange={(e) => setMachine(e.target.value as CardioMachine)}>
            {MACHINES.map((m) => (
              <option key={m} value={m}>
                {MACHINE_LABELS[m]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Stufe (optional)">
          {(p) => <Input {...p} type="number" min={1} inputMode="numeric" value={level} onChange={(e) => setLevel(e.target.value)} />}
        </Field>
        <Field label="Zeit (Min.)">
          {(p) => <Input {...p} type="number" min={1} inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} />}
        </Field>
      </div>
      <Field label="Intensität" hint="z. B. 9 km/h, 120 W oder „mittel“">
        {(p) => <Input {...p} value={intensity} onChange={(e) => setIntensity(e.target.value)} />}
      </Field>
      {error && <Callout tone="danger">{error}</Callout>}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onClose}>
          Abbrechen
        </Button>
        <Button type="submit" variant="primary" disabled={create.isPending}>
          Speichern
        </Button>
      </div>
    </form>
  );
}

// Optional cardio tracking — a free-form addition next to the strength plan, since a cardio
// session (machine + level/intensity/duration) doesn't fit the sets/reps/weight shape.
export function CardioCard() {
  const { data: logs } = useWeekCardioLogs();
  const remove = useDeleteCardioLog();
  const [open, setOpen] = useState(false);

  const week = logs ?? [];
  const today = utcDayKey(new Date());
  const minutesToday = week.filter((l) => l.performedAt.slice(0, 10) === today).reduce((s, l) => s + l.durationMinutes, 0);
  const minutesWeek = week.reduce((s, l) => s + l.durationMinutes, 0);

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          Cardio <Badge>optional</Badge>
        </span>
      }
      action={
        <Button size="sm" variant="secondary" iconLeft={<Plus size={14} aria-hidden />} onClick={() => setOpen(true)}>
          Eintragen
        </Button>
      }
    >
      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Min. heute" value={minutesToday} className="p-3" />
        <StatTile label="Min. Woche" value={minutesWeek} className="p-3" />
        <StatTile label="Einheiten" value={week.length} sub="diese Woche" className="p-3" />
      </div>

      <div className="mt-3">
        {week.length === 0 ? (
          <EmptyState icon={<Activity size={18} aria-hidden />} text="Diese Woche noch kein Cardio." className="py-4" />
        ) : (
          week.slice(0, 5).map((log) => (
            <ListRow key={log.id} value={`${log.durationMinutes} min`}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-body">{MACHINE_LABELS[log.machine]}</p>
                  <p className="truncate text-xs text-text-faint">
                    {new Date(log.performedAt).toLocaleDateString("de-DE", { weekday: "short" })}
                    {log.level ? ` · Stufe ${log.level}` : ""} · {log.intensity}
                  </p>
                </div>
                <IconButton
                  aria-label={`${MACHINE_LABELS[log.machine]} löschen`}
                  className="border-transparent bg-transparent"
                  onClick={() => remove.mutate(log.id)}
                >
                  <Trash2 size={16} aria-hidden />
                </IconButton>
              </div>
            </ListRow>
          ))
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen} title="Cardio eintragen">
        <CardioForm onClose={() => setOpen(false)} />
      </Dialog>
    </Card>
  );
}

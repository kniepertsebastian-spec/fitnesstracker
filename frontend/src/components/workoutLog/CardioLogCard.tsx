import { useState } from "react";
import type { CardioLogDto, CardioMachine, CreateCardioLogInput } from "@fitnesstracker/shared";
import { useCreateCardioLog, useDeleteCardioLog, useTodayCardioLogs } from "../../hooks/useCardioLogs";

const MACHINE_LABELS: Record<CardioMachine, string> = {
  TREADMILL: "Laufband",
  BIKE: "Fahrrad",
  STEPPER: "Stepper",
  STAIRMASTER: "Stairmaster",
};

const MACHINES = Object.keys(MACHINE_LABELS) as CardioMachine[];

interface DraftRow {
  key: number;
  machine: CardioMachine;
  level: string;
  intensity: string;
  durationMinutes: string;
}

let nextDraftKey = 0;
function emptyDraftRow(): DraftRow {
  return { key: nextDraftKey++, machine: "TREADMILL", level: "", intensity: "", durationMinutes: "" };
}

interface SavedRowProps {
  log: CardioLogDto;
  onDelete: () => void;
}

function SavedCardioRow({ log, onDelete }: SavedRowProps) {
  return (
    <tr className="border-b border-ink-900 text-ink-400">
      <td className="py-2 pr-1 text-ink-200">{MACHINE_LABELS[log.machine]}</td>
      <td className="py-2 pr-1 text-center">{log.level ?? "–"}</td>
      <td className="py-2 pr-1 text-center">{log.intensity}</td>
      <td className="py-2 pr-1 text-center">{log.durationMinutes} min</td>
      <td className="py-2 text-center">
        <button onClick={onDelete} className="text-red-400 hover:text-red-300" aria-label="Löschen">
          ×
        </button>
      </td>
    </tr>
  );
}

interface DraftRowProps {
  row: DraftRow;
  hasError: boolean;
  saving: boolean;
  onChange: (patch: Partial<DraftRow>) => void;
  onSave: () => void;
}

// One editable cardio row: machine picked from a dropdown (rather than a fixed column per
// machine, which would leave three columns empty for every row), level/duration as plain number
// inputs, intensity as free text since what "intensity" means varies by machine (km/h, watts, an
// incline %, or just "mittel") — no single numeric unit fits all four. The checkmark saves the
// row as its own CardioLog and it disappears from the drafts (replaced by the fetched, locked
// SavedCardioRow above) — no "next exercise" concept to jump to since these aren't sequenced.
function DraftCardioRow({ row, hasError, saving, onChange, onSave }: DraftRowProps) {
  return (
    <>
      <tr className={hasError ? "" : "border-b border-ink-900"}>
        <td className="py-2 pr-1">
          <select
            value={row.machine}
            onChange={(e) => onChange({ machine: e.target.value as CardioMachine })}
            className="w-full rounded border border-ink-700 bg-ink-950 px-1 py-1 text-xs text-ink-100"
          >
            {MACHINES.map((machine) => (
              <option key={machine} value={machine}>
                {MACHINE_LABELS[machine]}
              </option>
            ))}
          </select>
        </td>
        <td className="py-2 pr-1">
          <input
            type="number"
            min={1}
            value={row.level}
            onChange={(e) => onChange({ level: e.target.value })}
            className="w-9 rounded border border-ink-700 bg-ink-950 px-1 py-1 text-center text-sm"
          />
        </td>
        <td className="py-2 pr-1">
          <input
            type="text"
            value={row.intensity}
            onChange={(e) => onChange({ intensity: e.target.value })}
            className="w-16 rounded border border-ink-700 bg-ink-950 px-1 py-1 text-center text-sm"
          />
        </td>
        <td className="py-2 pr-1">
          <input
            type="number"
            min={1}
            value={row.durationMinutes}
            onChange={(e) => onChange({ durationMinutes: e.target.value })}
            className="w-11 rounded border border-ink-700 bg-ink-950 px-1 py-1 text-center text-sm"
          />
        </td>
        <td className="py-2 text-center">
          <button
            onClick={onSave}
            disabled={saving}
            className="text-emerald-400 hover:text-emerald-300"
            aria-label="Speichern"
          >
            ✓
          </button>
        </td>
      </tr>
      {hasError && (
        <tr className="border-b border-ink-900">
          <td colSpan={5} className="pb-2 text-xs text-red-400">
            Intensität und Zeit ausfüllen
          </td>
        </tr>
      )}
    </>
  );
}

// Optional cardio tracking below the plan diary — a free-form addition, not slotted into the
// strength split, since a cardio session (machine + level/intensity/duration) doesn't fit the
// sets/reps/weight shape at all. "Add row" lets two different machines in one session be tracked
// as two separate entries instead of being forced into one.
export function CardioLogCard() {
  const { data: logs } = useTodayCardioLogs();
  const createLog = useCreateCardioLog();
  const deleteLog = useDeleteCardioLog();
  const [drafts, setDrafts] = useState<DraftRow[]>([emptyDraftRow()]);
  const [errorKey, setErrorKey] = useState<number | null>(null);

  const updateDraft = (key: number, patch: Partial<DraftRow>) => {
    setDrafts((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const addRow = () => setDrafts((rows) => [...rows, emptyDraftRow()]);

  const saveDraft = async (row: DraftRow) => {
    const level = row.level.trim() === "" ? null : Number(row.level);
    const durationMinutes = Number(row.durationMinutes);
    const intensity = row.intensity.trim();
    const levelValid = level === null || (Number.isInteger(level) && level > 0);
    if (!levelValid || !Number.isInteger(durationMinutes) || durationMinutes <= 0 || intensity === "") {
      setErrorKey(row.key);
      return;
    }
    setErrorKey(null);
    const input: CreateCardioLogInput = { machine: row.machine, level, intensity, durationMinutes };
    await createLog.mutateAsync(input);
    setDrafts((rows) => {
      const rest = rows.filter((r) => r.key !== row.key);
      return rest.length === 0 ? [emptyDraftRow()] : rest;
    });
  };

  return (
    <div className="rounded-lg border border-ink-800 bg-ink-900 p-4">
      <p className="mb-1 text-sm font-medium text-ink-300">Cardio</p>
      <p className="mb-3 text-xs text-ink-500">Optional · Ausdauereinheiten protokollieren</p>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-ink-800 text-left text-xs text-ink-500">
              <th className="pb-1 pr-1 font-medium">Übung</th>
              <th className="pb-1 pr-1 font-medium">Stufe</th>
              <th className="pb-1 pr-1 font-medium">Intensität</th>
              <th className="pb-1 pr-1 font-medium">Zeit</th>
              <th className="pb-1 font-medium" />
            </tr>
          </thead>
          <tbody>
            {(logs ?? []).map((log) => (
              <SavedCardioRow key={log.id} log={log} onDelete={() => deleteLog.mutate(log.id)} />
            ))}
            {drafts.map((row) => (
              <DraftCardioRow
                key={row.key}
                row={row}
                hasError={errorKey === row.key}
                saving={createLog.isPending}
                onChange={(patch) => updateDraft(row.key, patch)}
                onSave={() => saveDraft(row)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <button onClick={addRow} className="mt-2 text-xs text-violet-400 hover:underline">
        + Add row
      </button>
    </div>
  );
}

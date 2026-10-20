import { useState } from "react";
import { Card, Button, Field, Input } from "../ui";
import { useBodyCompositionEntries, useCreateBodyCompositionEntry } from "../../hooks/useBodyComposition";
import { meanWeight } from "../../lib/stats";
import { formatKg } from "../../lib/trainingSets";

const DAY_MS = 24 * 60 * 60 * 1000;

// Log today's weight in one field; the 7-day mean smooths out the daily water swings.
export function QuickWeightCard() {
  const { data: entries } = useBodyCompositionEntries();
  const create = useCreateBodyCompositionEntry();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const now = Date.now();
  const all = entries ?? [];
  const mean = meanWeight(all, new Date(now - 7 * DAY_MS), new Date(now + DAY_MS));
  const previousMean = meanWeight(all, new Date(now - 14 * DAY_MS), new Date(now - 7 * DAY_MS));
  const latest = [...all].sort((a, b) => (a.measuredAt < b.measuredAt ? 1 : -1))[0];
  const delta = mean !== null && previousMean !== null ? mean - previousMean : null;

  const parsed = Number(value.replace(",", "."));
  const valid = value.trim() !== "" && Number.isFinite(parsed) && parsed > 0 && parsed <= 500;

  const submit = async () => {
    if (!valid) return;
    setError(null);
    try {
      await create.mutateAsync({ weightKg: parsed });
      setValue("");
    } catch {
      setError("Gewicht konnte nicht gespeichert werden.");
    }
  };

  return (
    <Card title="Körpergewicht">
      <p className="tabular text-h2 text-text">
        {mean !== null ? formatKg(Math.round(mean * 10) / 10) : "–"}
        {mean !== null && <span className="ml-1 text-small text-text-subtle">kg · Ø 7 Tage</span>}
      </p>
      <p className="mt-0.5 text-small text-text-subtle">
        {latest ? `Zuletzt ${formatKg(latest.weightKg)} kg` : "Noch keine Messung"}
        {delta !== null && ` · ${delta > 0 ? "+" : ""}${formatKg(Math.round(delta * 10) / 10)} kg zur Vorwoche`}
      </p>
      <form
        className="mt-3 flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Field label="Heute (kg)" className="flex-1">
          {(p) => (
            <Input {...p} type="text" inputMode="decimal" placeholder="z. B. 82,4" value={value} onChange={(e) => setValue(e.target.value)} />
          )}
        </Field>
        <Button type="submit" variant="primary" disabled={!valid || create.isPending}>
          Speichern
        </Button>
      </form>
      {error && <p className="mt-2 text-small text-danger">{error}</p>}
    </Card>
  );
}

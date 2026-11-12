import { useState } from "react";
import { Trash2 } from "lucide-react";
import { ApiError } from "../../api/client";
import { useBodyFatCalibrations, useCreateBodyFatCalibration, useDeleteBodyFatCalibration } from "../../hooks/useBodyComposition";
import { Button, Callout, Field, IconButton, Input, ListRow } from "../ui";

const num = (value: number) => value.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const signed = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : "±"}${num(Math.abs(value))}`;
const dateText = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

// Optional: one reference reading (e.g. a DEXA scan) turns the rough formula into a personal one.
// The server compares it with the estimate from the tape measurement nearest to that day and keeps
// the difference.
export function BodyFatCalibrationSection() {
  const { data: calibrations } = useBodyFatCalibrations();
  const create = useCreateBodyFatCalibration();
  const remove = useDeleteBodyFatCalibration();
  const [measuredOn, setMeasuredOn] = useState(todayKey);
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const value = Number(reference.replace(",", "."));
    if (!value || value < 2 || value > 70) {
      setError("Trag den Körperfettwert des Scans ein (2–70 %).");
      return;
    }
    setError(null);
    try {
      await create.mutateAsync({ measuredOn, referencePercent: value });
      setReference("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Konnte nicht gespeichert werden.");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-small text-text-subtle">
        Hast du einen DEXA-Scan oder eine andere Referenzmessung machen lassen? Trag den Wert mit Datum ein. Die App
        vergleicht ihn mit ihrer Schätzung für diesen Tag und verschiebt künftige Schätzungen um die Differenz. Dafür braucht
        es eine Messung mit Taille, höchstens 7 Tage vom Scan entfernt.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Datum des Scans">{(p) => <Input {...p} type="date" max={todayKey()} value={measuredOn} onChange={(e) => setMeasuredOn(e.target.value)} />}</Field>
        <Field label="Körperfett (%)">
          {(p) => <Input {...p} type="number" step="0.1" inputMode="decimal" value={reference} onChange={(e) => setReference(e.target.value)} />}
        </Field>
      </div>
      <Button variant="secondary" fullWidth onClick={submit} disabled={create.isPending}>
        Kalibrieren
      </Button>
      {error && <Callout tone="danger">{error}</Callout>}
      {calibrations && calibrations.length > 0 && (
        <div>
          {calibrations.map((c, i) => (
            <ListRow key={c.id}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-body text-text-muted">
                    {dateText(c.measuredOn)}: {num(c.referencePercent)} %{i === 0 && " (gilt aktuell)"}
                  </p>
                  <p className="text-xs text-text-faint">
                    Schätzung damals {num(c.estimatePercent)} %, Verschiebung {signed(c.offsetPercent)} Prozentpunkte
                  </p>
                </div>
                <IconButton
                  aria-label={`Kalibrierung vom ${dateText(c.measuredOn)} löschen`}
                  className="border-transparent bg-transparent hover:text-danger-text"
                  onClick={() => remove.mutate(c.id)}
                >
                  <Trash2 size={16} aria-hidden />
                </IconButton>
              </div>
            </ListRow>
          ))}
        </div>
      )}
    </div>
  );
}

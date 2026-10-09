import { useState } from "react";
import { ApiError } from "../../api/client";
import { BODY_METRIC_INFO, categorizeBodyFat } from "../../data/bodyMetricsInfo";
import {
  useBodyCompositionEntries,
  useCreateBodyCompositionEntry,
  useDeleteBodyCompositionEntry,
} from "../../hooks/useBodyComposition";
import { useProfile } from "../../hooks/useProfile";
import { ArrowDown, ArrowRight, ArrowUp, Scale, Trash2 } from "lucide-react";
import { Button, Callout, Card, EmptyState, Field, IconButton, Input, ListRow, Skeleton, StatTile } from "../ui";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Neutral up/down/flat icon — deliberately no "up is bad, down is good" coloring: a weight
// increase is exactly the goal for some users.
function Trend({ current, previous }: { current: number; previous: number | null | undefined }) {
  if (previous === null || previous === undefined) return null;
  const Icon = current > previous ? ArrowUp : current < previous ? ArrowDown : ArrowRight;
  const label = current > previous ? "gestiegen" : current < previous ? "gesunken" : "unverändert";
  return <Icon size={14} aria-label={label} className="inline text-text-faint" />;
}

export function BodyCompositionCard() {
  const { data: entries, isLoading } = useBodyCompositionEntries();
  const { data: profile } = useProfile();
  const createEntry = useCreateBodyCompositionEntry();
  const deleteEntry = useDeleteBodyCompositionEntry();

  const [weightKg, setWeightKg] = useState("");
  const [bodyFatPercent, setBodyFatPercent] = useState("");
  const [muscleMassKg, setMuscleMassKg] = useState("");
  const [bodyWaterPercent, setBodyWaterPercent] = useState("");
  const [error, setError] = useState<string | null>(null);

  const latest = entries?.[0];
  const previous = entries?.[1];

  const handleAdd = async () => {
    const weight = Number(weightKg);
    if (!weight || weight <= 0) {
      setError("Gewicht ist Pflicht.");
      return;
    }
    setError(null);
    try {
      await createEntry.mutateAsync({
        weightKg: weight,
        bodyFatPercent: bodyFatPercent ? Number(bodyFatPercent) : undefined,
        muscleMassKg: muscleMassKg ? Number(muscleMassKg) : undefined,
        bodyWaterPercent: bodyWaterPercent ? Number(bodyWaterPercent) : undefined,
      });
      setWeightKg("");
      setBodyFatPercent("");
      setMuscleMassKg("");
      setBodyWaterPercent("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Konnte nicht gespeichert werden.");
    }
  };

  const metricField = (label: string, value: string, set: (v: string) => void) => (
    <Field label={label}>
      {(p) => <Input {...p} type="number" step="0.1" inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} />}
    </Field>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start">
        <Card title="Neue Messung">
          <div className="grid grid-cols-2 gap-3">
            {metricField("Gewicht (kg)", weightKg, setWeightKg)}
            {metricField("Körperfett (%)", bodyFatPercent, setBodyFatPercent)}
            {metricField("Muskelmasse (kg)", muscleMassKg, setMuscleMassKg)}
            {metricField("Wasseranteil (%)", bodyWaterPercent, setBodyWaterPercent)}
          </div>
          <Button variant="primary" size="lg" fullWidth className="mt-3" onClick={handleAdd}>
            Speichern
          </Button>
          {error && (
            <Callout tone="danger" className="mt-3">
              {error}
            </Callout>
          )}
        </Card>

        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : latest ? (
          <Card title="Letzte Messung" action={<span className="text-small text-text-subtle">{formatDate(latest.measuredAt)}</span>}>
            <div className="grid grid-cols-2 gap-3">
              <StatTile
                className="p-3"
                label={BODY_METRIC_INFO.weightKg.label}
                value={<>{latest.weightKg} <Trend current={latest.weightKg} previous={previous?.weightKg} /></>}
                unit="kg"
              />
              {latest.bodyFatPercent !== null && (
                <StatTile
                  className="p-3"
                  label={BODY_METRIC_INFO.bodyFatPercent.label}
                  value={<>{latest.bodyFatPercent} <Trend current={latest.bodyFatPercent} previous={previous?.bodyFatPercent} /></>}
                  unit="%"
                  sub={categorizeBodyFat(latest.bodyFatPercent, profile?.gender) ?? undefined}
                />
              )}
              {latest.muscleMassKg !== null && (
                <StatTile
                  className="p-3"
                  label={BODY_METRIC_INFO.muscleMassKg.label}
                  value={<>{latest.muscleMassKg} <Trend current={latest.muscleMassKg} previous={previous?.muscleMassKg} /></>}
                  unit="kg"
                />
              )}
              {latest.bodyWaterPercent !== null && (
                <StatTile
                  className="p-3"
                  label={BODY_METRIC_INFO.bodyWaterPercent.label}
                  value={<>{latest.bodyWaterPercent} <Trend current={latest.bodyWaterPercent} previous={previous?.bodyWaterPercent} /></>}
                  unit="%"
                />
              )}
            </div>
          </Card>
        ) : (
          <Card>
            <EmptyState icon={<Scale size={18} aria-hidden />} text="Noch keine Messung erfasst." />
          </Card>
        )}
      </div>

      <Card title="Was bedeuten die Werte?">
        <div className="grid gap-3 lg:grid-cols-2">
          {Object.values(BODY_METRIC_INFO).map((info) => (
            <div key={info.label}>
              <p className="text-body font-medium text-text-2">{info.label}</p>
              <p className="text-small text-text-subtle">{info.description}</p>
            </div>
          ))}
        </div>
      </Card>

      {entries && entries.length > 0 && (
        <Card title="Verlauf">
          {entries.map((entry) => (
            <ListRow key={entry.id}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-body text-text-muted">{formatDate(entry.measuredAt)}</p>
                  <p className="text-xs text-text-faint">
                    {entry.weightKg} kg
                    {entry.bodyFatPercent !== null && ` · ${entry.bodyFatPercent} % KF`}
                    {entry.muscleMassKg !== null && ` · ${entry.muscleMassKg} kg Muskeln`}
                    {entry.bodyWaterPercent !== null && ` · ${entry.bodyWaterPercent} % Wasser`}
                  </p>
                </div>
                <IconButton
                  aria-label={`Messung vom ${formatDate(entry.measuredAt)} löschen`}
                  className="border-transparent bg-transparent hover:text-danger-text"
                  onClick={() => deleteEntry.mutate(entry.id)}
                >
                  <Trash2 size={16} aria-hidden />
                </IconButton>
              </div>
            </ListRow>
          ))}
        </Card>
      )}
    </div>
  );
}

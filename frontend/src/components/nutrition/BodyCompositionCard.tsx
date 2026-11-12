import { useMemo, useState } from "react";
import { CalcInfoButton } from "../info/CalcInfoButton";

import { ApiError } from "../../api/client";
import { BODY_METRIC_INFO, categorizeBodyFat } from "../../data/bodyMetricsInfo";
import {
  useBodyCompositionEntries,
  useCreateBodyCompositionEntry,
  useDeleteBodyCompositionEntry,
} from "../../hooks/useBodyComposition";
import { useProfile } from "../../hooks/useProfile";
import { latestSessionAverage } from "@fitnesstracker/shared";
import { entriesToReadings } from "../../lib/scaleReadings";
import { BodyFatEstimateCard } from "./BodyFatEstimateCard";
import { ArrowDown, ArrowRight, ArrowUp, Scale, Trash2 } from "lucide-react";
import { Button, Callout, Card, Disclosure, EmptyState, Field, IconButton, Input, ListRow, Skeleton, StatTile } from "../ui";
import { formatKg } from "../../lib/trainingSets";
import { weightTrendAt, TREND_WINDOW_DAYS } from "../../lib/weightTrend";

const num = (value: number) => value.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const clock = (iso: string) => new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Neutral up/down/flat icon — deliberately no "up is bad, down is good" coloring: a weight
// increase is exactly the goal for some users. Only the weight gets one: the scale's fat, muscle
// and water values jump by several kg between two weigh-ins minutes apart (see the scale analysis
// card), so an arrow on them would show noise as if it were a change.
function Trend({ current, previous }: { current: number; previous: number | null | undefined }) {
  if (previous === null || previous === undefined) return null;
  const Icon = current > previous ? ArrowUp : current < previous ? ArrowDown : ArrowRight;
  const label = current > previous ? "gestiegen" : current < previous ? "gesunken" : "unverändert";
  return <Icon size={14} aria-label={label} className="inline text-text-faint" />;
}

export function BodyCompositionCard() {
  const { data: entries, isLoading } = useBodyCompositionEntries();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const createEntry = useCreateBodyCompositionEntry();
  const deleteEntry = useDeleteBodyCompositionEntry();

  const [weightKg, setWeightKg] = useState("");
  const [bodyFatPercent, setBodyFatPercent] = useState("");
  const [muscleMassKg, setMuscleMassKg] = useState("");
  const [bodyWaterPercent, setBodyWaterPercent] = useState("");
  const [waistCm, setWaistCm] = useState("");
  const [neckCm, setNeckCm] = useState("");
  const [hipCm, setHipCm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const latest = entries?.[0];
  const previous = entries?.[1];
  // Mean of the newest weigh-ins in a row (within an hour): the scale's fat, muscle and water
  // values scatter by several kg between them, the mean scatters less.
  const sessionAverage = useMemo(() => (entries ? latestSessionAverage(entriesToReadings(entries)) : null), [entries]);
  const hasAverage = !!sessionAverage && sessionAverage.readings >= 2;
  // The main weight is the 7-day mean, not the last reading, which jumps from day to day.
  const trend = useMemo(() => (latest && entries ? weightTrendAt(entries, latest.measuredAt) : null), [entries, latest]);
  const trendBefore = useMemo(() => {
    if (!latest || !entries) return null;
    return weightTrendAt(entries, new Date(new Date(latest.measuredAt).getTime() - TREND_WINDOW_DAYS * 24 * 60 * 60 * 1000));
  }, [entries, latest]);

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
        waistCm: waistCm ? Number(waistCm) : undefined,
        neckCm: neckCm ? Number(neckCm) : undefined,
        hipCm: hipCm ? Number(hipCm) : undefined,
      });
      setWeightKg("");
      setBodyFatPercent("");
      setMuscleMassKg("");
      setBodyWaterPercent("");
      setWaistCm("");
      setNeckCm("");
      setHipCm("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Konnte nicht gespeichert werden.");
    }
  };

  const metricField = (label: string, value: string, set: (v: string) => void) => (
    <Field label={label}>
      {(p) => <Input {...p} type="number" step="0.1" inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} />}
    </Field>
  );

  const isFemale = profile?.gender === "FEMALE";

  const newMeasurement = (
    <Card title="Neue Messung">
      <div className="grid grid-cols-2 gap-3">
        {metricField("Gewicht (kg)", weightKg, setWeightKg)}
        {metricField("Körperfett (%)", bodyFatPercent, setBodyFatPercent)}
        {metricField("Muskelmasse (kg)", muscleMassKg, setMuscleMassKg)}
        {metricField("Wasseranteil (%)", bodyWaterPercent, setBodyWaterPercent)}
      </div>
      <p className="mt-4 text-small font-medium text-text-2">Umfänge (cm)</p>
      <div className={isFemale ? "mt-2 grid grid-cols-3 gap-3" : "mt-2 grid grid-cols-2 gap-3"}>
        {metricField("Taille", waistCm, setWaistCm)}
        {metricField("Hals", neckCm, setNeckCm)}
        {isFemale && metricField("Hüfte", hipCm, setHipCm)}
      </div>
      <details className="mt-1">
        <summary className="min-h-11 cursor-pointer py-2.5 text-small text-accent-text">So misst du richtig</summary>
        <ul className="list-disc space-y-1 pl-5 text-small text-text-subtle">
          <li>Morgens messen, nüchtern und vor dem Training.</li>
          <li>Taille: Maßband waagerecht auf Nabelhöhe, entspannt ausgeatmet, nicht einziehen.</li>
          <li>Hals: knapp unter dem Kehlkopf, Kopf gerade.</li>
          {isFemale && <li>Hüfte: an der breitesten Stelle des Gesäßes.</li>}
          <li>Band eng anlegen, ohne die Haut einzudrücken. Zweimal messen und den Mittelwert eintragen.</li>
        </ul>
      </details>
      <Button variant="primary" size="lg" fullWidth className="mt-3" onClick={handleAdd}>
        Speichern
      </Button>
      {error && (
        <Callout tone="danger" className="mt-3">
          {error}
        </Callout>
      )}
    </Card>
  );

  const lastMeasurement = isLoading ? (
    <Skeleton className="h-40 w-full" />
  ) : latest ? (
    <Card title="Letzte Messung" action={<span className="text-small text-text-subtle">{formatDate(latest.measuredAt)}</span>}>
      <div className="grid grid-cols-2 gap-3">
        <StatTile
          className="p-3"
          label={trend !== null ? `${BODY_METRIC_INFO.weightKg.label} (Ø ${TREND_WINDOW_DAYS} Tage)` : BODY_METRIC_INFO.weightKg.label}
          value={formatKg(trend ?? latest.weightKg)}
          unit="kg"
          trend={trend !== null && trendBefore !== null ? <Trend current={trend} previous={trendBefore} /> : <Trend current={latest.weightKg} previous={previous?.weightKg} />}
          sub={trend !== null ? `letzter Wert ${formatKg(latest.weightKg)} kg` : undefined}
        />
        {latest.bodyFatPercent !== null && (
          <StatTile
            className="p-3"
            label={BODY_METRIC_INFO.bodyFatPercent.label}
            value={formatKg(latest.bodyFatPercent)}
            unit="%"
            sub={categorizeBodyFat(latest.bodyFatPercent, profile?.gender) ?? undefined}
            info={<CalcInfoButton id="body-fat-category" />}
          />
        )}
        {latest.muscleMassKg !== null && (
          <StatTile className="p-3" label={BODY_METRIC_INFO.muscleMassKg.label} value={formatKg(latest.muscleMassKg)} unit="kg" />
        )}
        {latest.bodyWaterPercent !== null && (
          <StatTile className="p-3" label={BODY_METRIC_INFO.bodyWaterPercent.label} value={formatKg(latest.bodyWaterPercent)} unit="%" />
        )}
      </div>
      {hasAverage && sessionAverage && (
        <p className="mt-3 text-small text-text-2">
          Mittel aus {sessionAverage.readings} Messungen ({clock(sessionAverage.from)}–{clock(sessionAverage.to)}):
          {sessionAverage.bodyFatPercent !== null && ` Körperfett ${num(sessionAverage.bodyFatPercent)} %`}
          {sessionAverage.bodyFatRange !== null && ` (Spanne ${num(sessionAverage.bodyFatRange)})`}
          {sessionAverage.muscleMassKg !== null && ` · Muskelmasse ${num(sessionAverage.muscleMassKg)} kg`}
          {sessionAverage.bodyWaterPercent !== null && ` · Wasser ${num(sessionAverage.bodyWaterPercent)} %`}
        </p>
      )}
    </Card>
  ) : (
    <Card>
      <EmptyState icon={<Scale size={18} aria-hidden />} text="Noch keine Messung erfasst." />
    </Card>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Latest first, then the form: the result you came for is on top, entering is one scroll away. */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start">
        {lastMeasurement}
        {newMeasurement}
      </div>

      {latest && !profileLoading && (
        <BodyFatEstimateCard
          entries={entries ?? []}
          profile={profile}
          average={hasAverage && sessionAverage?.bodyFatPercent != null ? { bodyFatPercent: sessionAverage.bodyFatPercent, readings: sessionAverage.readings } : undefined}
        />
      )}

      {entries && entries.length > 0 && (
        <Card title="Verlauf">
          {entries.map((entry) => {
            const entryTrend = weightTrendAt(entries, entry.measuredAt);
            return (
              <ListRow key={entry.id}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-body text-text-muted">{formatDate(entry.measuredAt)}</p>
                    <p className="text-xs text-text-faint">
                      {formatKg(entry.weightKg)} kg
                      {entryTrend !== null && ` (Ø ${formatKg(entryTrend)})`}
                      {entry.waistCm !== null && ` · Taille ${formatKg(entry.waistCm)} cm`}
                      {entry.bodyFatPercent !== null && ` · ${formatKg(entry.bodyFatPercent)} % KF`}
                      {entry.muscleMassKg !== null && ` · ${formatKg(entry.muscleMassKg)} kg Muskeln`}
                      {entry.bodyWaterPercent !== null && ` · ${formatKg(entry.bodyWaterPercent)} % Wasser`}
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
            );
          })}
        </Card>
      )}

      <Disclosure title="Was bedeuten die Werte?">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {Object.values(BODY_METRIC_INFO).map((info) => (
            <div key={info.label}>
              <p className="text-body font-medium text-text-2">{info.label}</p>
              <p className="text-small text-text-subtle">{info.description}</p>
            </div>
          ))}
        </div>
      </Disclosure>
    </div>
  );
}

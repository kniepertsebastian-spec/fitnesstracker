import { useMemo, useState } from "react";
import { CalcInfoButton } from "../components/info/CalcInfoButton";

import { useBodyCompositionEntries } from "../../hooks/useBodyComposition";
import { useProfile } from "../../hooks/useProfile";
import { Card, Callout, Field, Input, Skeleton, StatTile } from "../ui";

function kg(value: number) {
  return value.toLocaleString("de-DE", { maximumFractionDigits: 1 });
}

function pct(value: number) {
  return value.toLocaleString("de-DE", { maximumFractionDigits: 1 });
}

function delta(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded.toLocaleString("de-DE", { maximumFractionDigits: 1 })}`;
}

/**
 * Estimates a fat-loss target while assuming fat-free mass is maintained.
 * This is an orientation only; consumer body-composition scales can be noisy.
 */
export function FatLossGoalCard() {
  const { data: entries, isLoading } = useBodyCompositionEntries();
  const { data: profile } = useProfile();
  const [targetBodyFat, setTargetBodyFat] = useState("20");

  const latest = entries?.[0];
  const previous = entries?.[1];
  const baseline = entries?.length ? entries[entries.length - 1] : undefined;
  const target = Number(targetBodyFat);

  const estimate = useMemo(() => {
    if (!latest || latest.bodyFatPercent === null) return null;
    if (!Number.isFinite(target) || target < 3 || target >= latest.bodyFatPercent) return null;
    const fatMass = latest.weightKg * latest.bodyFatPercent / 100;
    const fatFreeMass = latest.weightKg - fatMass;
    const targetWeight = fatFreeMass / (1 - target / 100);
    const targetFatMass = targetWeight * target / 100;
    return {
      fatMass,
      fatFreeMass,
      targetWeight,
      fatLoss: Math.max(0, fatMass - targetFatMass),
    };
  }, [latest, target]);

  if (isLoading) return <Card title="Dein Abnehmziel & Muskelerhalt"><Skeleton className="h-36 w-full" /></Card>;

  return (
    <Card title="Dein Abnehmziel & Muskelerhalt" action={<CalcInfoButton id="fat-loss-target" />}>
      {!latest ? (
        <p className="text-small text-text-subtle">Erfasse zuerst eine Körpermessung mit Gewicht und Körperfettanteil. Danach kann die App ein persönliches Orientierungsziel berechnen.</p>
      ) : latest.bodyFatPercent === null ? (
        <Callout tone="info">Für die Berechnung fehlt bei deiner letzten Messung der Körperfettanteil. Ergänze ihn bei einer neuen Messung, um Zielgewicht und geschätzten Fettverlust zu sehen.</Callout>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-small text-text-subtle">
            Die Schätzung nimmt an, dass deine fettfreie Masse erhalten bleibt. Das ist ein Rechenmodell, keine Garantie: Messwerte von Körperfettwaagen schwanken und fettfreie Masse ist nicht gleich Muskelmasse.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <StatTile className="p-3" label="Aktuelles Gewicht" value={kg(latest.weightKg)} unit="kg" />
            <StatTile className="p-3" label="Körperfett" value={pct(latest.bodyFatPercent)} unit="%" />
            <StatTile className="p-3" label="Geschätzte Fettmasse" value={kg(estimate?.fatMass ?? latest.weightKg * latest.bodyFatPercent / 100)} unit="kg" />
            <StatTile className="p-3" label="Muskelmasse (Messwert)" value={latest.muscleMassKg === null ? "—" : kg(latest.muscleMassKg)} unit={latest.muscleMassKg === null ? undefined : "kg"} />
          </div>
          <div className="max-w-sm">
            <Field label="Gewünschter Ziel-Körperfettanteil (%)">
              {(props) => <Input {...props} type="number" min="3" max="60" step="0.5" inputMode="decimal" value={targetBodyFat} onChange={(event) => setTargetBodyFat(event.target.value)} />}
            </Field>
          </div>
          {estimate ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <StatTile className="p-3" label="Geschätztes Zielgewicht" value={kg(estimate.targetWeight)} unit="kg" />
              <StatTile className="p-3" label="Möglicher Fettverlust" value={kg(estimate.fatLoss)} unit="kg" />
            </div>
          ) : (
            <Callout tone="info">Wähle einen Ziel-Körperfettanteil zwischen 3 % und deinem aktuellen Wert ({pct(latest.bodyFatPercent)} %), damit ein niedrigeres Zielgewicht berechnet werden kann.</Callout>
          )}
          <div className="rounded-xl border border-border p-3">
            <h3 className="mb-2 text-body font-medium text-text">Fortschritt & Muskelerhalt</h3>
            {baseline && baseline.id !== latest.id ? (
              <p className="text-small text-text-subtle">
                Ausgangswert vom {new Date(baseline.measuredAt).toLocaleDateString("de-DE")}: {kg(baseline.weightKg)} kg
                {baseline.bodyFatPercent !== null ? `, ${pct(baseline.bodyFatPercent)} % Körperfett` : ""}
                {baseline.muscleMassKg !== null ? `, ${kg(baseline.muscleMassKg)} kg Muskelmasse` : ""}.
              </p>
            ) : (
              <p className="text-small text-text-subtle">Die älteste gespeicherte Messung dient als Ausgangswert. Erfasse weitere Messungen, um Veränderungen zu verfolgen.</p>
            )}
            {previous && (
              <div className="mt-2 flex flex-col gap-1 text-small text-text-2">
                <p>Seit der vorherigen Messung: Gewicht {delta(latest.weightKg - previous.weightKg)} kg
                  {latest.bodyFatPercent !== null && previous.bodyFatPercent !== null ? `, Körperfett ${delta(latest.bodyFatPercent - previous.bodyFatPercent)} Prozentpunkte` : ""}
                  {latest.muscleMassKg !== null && previous.muscleMassKg !== null ? `, Muskelmasse ${delta(latest.muscleMassKg - previous.muscleMassKg)} kg` : ""}.</p>
              </div>
            )}
            {baseline && baseline.id !== latest.id && (
              <p className="mt-1 text-small text-text-2">
                Seit dem Ausgangswert: Gewicht {delta(latest.weightKg - baseline.weightKg)} kg
                {latest.bodyFatPercent !== null && baseline.bodyFatPercent !== null ? `, Körperfett ${delta(latest.bodyFatPercent - baseline.bodyFatPercent)} Prozentpunkte` : ""}
                {latest.muscleMassKg !== null && baseline.muscleMassKg !== null ? `, Muskelmasse ${delta(latest.muscleMassKg - baseline.muscleMassKg)} kg` : ""}.
              </p>
            )}
            {profile && <p className="mt-2 text-xs text-text-subtle">Profil berücksichtigt: {profile.age} Jahre, {profile.heightCm} cm, Geschlecht {profile.gender === "MALE" ? "männlich" : "weiblich"}. Diese Angaben dienen hier zur Einordnung; die Körperfett-Zielrechnung basiert auf den Messwerten.</p>}
          </div>
          <p className="text-xs text-text-subtle">Orientierung statt medizinischer Vorgabe. Für den Muskelerhalt sind unter anderem Krafttraining, ausreichende Ernährung und eine moderate Abnahmerate wichtig.</p>
        </div>
      )}
    </Card>
  );
}

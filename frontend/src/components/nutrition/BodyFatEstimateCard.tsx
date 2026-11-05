import {
  BODY_FAT_GAP_THRESHOLD,
  FFMI_NATURAL_LIMIT,
  estimateBodyFatCunBae,
  fatFreeMassIndex,
  type BodyCompositionEntryDto,
  type ProfileDto,
} from "@fitnesstracker/shared";
import { CalcInfoButton } from "../info/CalcInfoButton";
import { Callout, Card, StatTile } from "../ui";

const percent = (value: number) => value.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// Cross-check for the scale's body-fat reading: the CUN-BAE estimate from BMI, age and sex, next to
// the measured value. Bioimpedance scales can be far off (athlete mode, hydration, hand/foot
// contact), and a value that implies a fat-free mass no natural physique reaches is a strong hint.
export function BodyFatEstimateCard({
  latest,
  profile,
  average,
}: {
  latest: BodyCompositionEntryDto;
  profile: Pick<ProfileDto, "heightCm" | "age" | "gender"> | null | undefined;
  // Mean body fat of the newest weigh-ins in a row; compared instead of the single reading.
  average?: { bodyFatPercent: number; readings: number };
}) {
  if (!profile) {
    return (
      <Card title="Körperfett-Schätzung">
        <p className="text-small text-text-subtle">
          Für eine Schätzung aus BMI, Alter und Geschlecht fehlen Größe, Alter und Geschlecht. Trag sie im Tab „Rechner“
          ein.
        </p>
      </Card>
    );
  }

  const estimate = estimateBodyFatCunBae({ weightKg: latest.weightKg, heightCm: profile.heightCm, age: profile.age, gender: profile.gender });
  if (estimate === null) return null;

  const measured = average ? average.bodyFatPercent : latest.bodyFatPercent;
  const gap = measured === null ? null : estimate - measured;
  const ffmi = measured === null ? null : fatFreeMassIndex(latest.weightKg, measured, profile.heightCm);
  const ffmiImplausible = ffmi !== null && ffmi > FFMI_NATURAL_LIMIT;
  const lowerThanEstimate = gap !== null && gap >= BODY_FAT_GAP_THRESHOLD;

  return (
    <Card title="Körperfett-Schätzung" action={<CalcInfoButton id="body-fat-estimate" />}>
      <div className="grid grid-cols-2 gap-3">
        <StatTile
          className="p-3"
          label="Aus BMI (CUN-BAE)"
          value={<>≈ {percent(estimate)}</>}
          unit="%"
          sub={`Spanne grob ${Math.round(Math.max(estimate - 5, 0))}–${Math.round(estimate + 5)}\u00a0%`}
        />
        {measured !== null && (
          <StatTile className="p-3" label={average ? `Waage (Mittel aus ${average.readings})` : "Gemessen (Waage)"} value={percent(measured)} unit="%" sub={ffmi === null ? undefined : `FFMI ${percent(ffmi)}`} />
        )}
      </div>

      {(lowerThanEstimate || ffmiImplausible) && measured !== null && (
        <Callout tone="warning" className="mt-3">
          <p>
            Der Waagenwert ({percent(measured)} %) liegt {Math.round(gap ?? 0)} Prozentpunkte unter der Schätzung.
            {ffmiImplausible && ffmi !== null && (
              <>
                {" "}
                Daraus ergäbe sich ein FFMI von {percent(ffmi)} kg/m², mehr als bei natürlich trainierten Menschen üblich
                ist (etwa bis {FFMI_NATURAL_LIMIT}).
              </>
            )}{" "}
            Der Wert ist deshalb vermutlich zu niedrig. Prüf in der Waagen-App, ob ein Athletenmodus aktiv ist, und
            gleiche ihn einmal mit Maßband oder DEXA-Scan ab. Für den Verlauf bleibt die Waage trotzdem nützlich, solange du
            gleich misst.
          </p>
          <p className="mt-2 text-xs text-text-subtle">
            Sehr viel Muskelmasse macht die BMI-Schätzung zu hoch. Orientierung, keine medizinische Aussage.
          </p>
        </Callout>
      )}
    </Card>
  );
}

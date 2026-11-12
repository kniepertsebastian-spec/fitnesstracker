import { useMemo } from "react";
import {
  BODY_FAT_GAP_THRESHOLD,
  FFMI_CHECK_MAX_BODY_FAT,
  FFMI_NATURAL_LIMIT,
  applyCalibrationOffset,
  bodyFatRange,
  estimateBodyFatCunBae,
  fatFreeMassIndex,
  ffmiLooksImplausible,
  waistToHeightRatio,
  type BodyCompositionEntryDto,
  type ProfileDto,
} from "@fitnesstracker/shared";
import { useBodyFatCalibrations } from "../../hooks/useBodyComposition";
import { CalcInfoButton } from "../info/CalcInfoButton";
import { Badge, Callout, Card, StatTile } from "../ui";
import { BodyFatCalibrationSection } from "./BodyFatCalibrationSection";

const percent = (value: number) => value.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const cm = (value: number) => value.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const signedCm = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : "±"}${cm(Math.abs(value))}`;
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
// "etwa 17–23" or, when both formulas agree after rounding, "etwa 21".
const rangeText = ({ low, high }: { low: number; high: number }) =>
  Math.round(low) === Math.round(high) ? `etwa ${Math.round(low)}` : `etwa ${Math.round(low)}–${Math.round(high)}`;

// Body fat is shown as a range from two tape-measure formulas (RFM, US Navy) with the waist trend
// as the main number: a circumference is measured, not modelled. The scale's value is a cross-check
// only. Without any waist measurement the BMI-based CUN-BAE stays as a fallback.
export function BodyFatEstimateCard({
  entries,
  profile,
  average,
}: {
  /** Newest first. */
  entries: BodyCompositionEntryDto[];
  profile: Pick<ProfileDto, "heightCm" | "age" | "gender"> | null | undefined;
  // Mean body fat of the newest weigh-ins in a row; compared instead of the single reading.
  average?: { bodyFatPercent: number; readings: number };
}) {
  const { data: calibrations } = useBodyFatCalibrations();
  const latest = entries[0];
  const tapeEntries = useMemo(() => entries.filter((e) => e.waistCm !== null), [entries]);
  const tape = tapeEntries[0];
  const previousTape = tapeEntries[1];

  if (!latest) return null;
  const title = "Körperfett-Schätzung";
  const info = <CalcInfoButton id="body-fat-estimate" />;

  if (!profile) {
    return (
      <Card title={title} action={info}>
        <p className="text-small text-text-subtle">
          Für eine Schätzung fehlen Größe, Alter und Geschlecht. Trag sie im Tab „Rechner“ ein.
        </p>
      </Card>
    );
  }

  const measured = average ? average.bodyFatPercent : latest.bodyFatPercent;
  const ffmi = measured === null ? null : fatFreeMassIndex(latest.weightKg, measured, profile.heightCm);
  const ffmiImplausible = ffmiLooksImplausible(ffmi, measured);
  const scaleTile =
    measured !== null ? (
      <StatTile
        className="p-3"
        label={average ? `Waage (Mittel aus ${average.readings})` : "Waage"}
        value={percent(measured)}
        unit="%"
        sub={ffmi === null ? undefined : `FFMI ${percent(ffmi)}`}
      />
    ) : null;

  // --- Fallback: no tape measurement yet ---------------------------------------------------------
  if (!tape || tape.waistCm === null) {
    const estimate = estimateBodyFatCunBae({ weightKg: latest.weightKg, heightCm: profile.heightCm, age: profile.age, gender: profile.gender });
    const lowerThanEstimate = estimate !== null && measured !== null && estimate - measured >= BODY_FAT_GAP_THRESHOLD;
    return (
      <Card title={title} action={info}>
        <Callout tone="info">
          Trag bei der nächsten Messung Taille und Hals ein (bei Frauen auch die Hüfte). Daraus schätzt die App einen
          Bereich, der für Trainierte deutlich besser passt als die Schätzung aus Gewicht und Größe.
        </Callout>
        {estimate !== null && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <StatTile
              className="p-3"
              label="Aus BMI (CUN-BAE)"
              value={<>≈ {percent(estimate)}</>}
              unit="%"
              sub={`Spanne grob ${Math.round(Math.max(estimate - 5, 0))}–${Math.round(estimate + 5)}\u00a0%`}
            />
            {scaleTile}
          </div>
        )}
        <p className="mt-2 text-xs text-text-subtle">
          Die BMI-Formel kennt keine Muskelmasse und liegt bei Menschen mit Krafttraining zu hoch.
        </p>
        {(lowerThanEstimate || ffmiImplausible) && measured !== null && (
          <ScaleWarning measured={measured} ffmi={ffmi} ffmiImplausible={ffmiImplausible} text={`liegt ${Math.round((estimate ?? 0) - measured)} Prozentpunkte unter der BMI-Schätzung`} />
        )}
        <details className="mt-3">
          <summary className="min-h-11 cursor-pointer py-2.5 text-small text-accent-text">Mit Referenzwert kalibrieren</summary>
          <BodyFatCalibrationSection />
        </details>
      </Card>
    );
  }

  // --- Tape measurements -------------------------------------------------------------------------
  const rawRange = bodyFatRange({ heightCm: profile.heightCm, gender: profile.gender, waistCm: tape.waistCm, neckCm: tape.neckCm, hipCm: tape.hipCm });
  const calibration = calibrations?.[0];
  const range = rawRange && (calibration ? applyCalibrationOffset(rawRange, calibration.offsetPercent) : rawRange);
  const ratio = waistToHeightRatio(tape.waistCm, profile.heightCm);
  const waistChange = previousTape?.waistCm != null ? tape.waistCm - previousTape.waistCm : null;
  const belowRange = range !== null && measured !== null && range.low - measured >= 5;
  const missingHip = profile.gender === "FEMALE" && tape.hipCm === null;
  const missingNeck = tape.neckCm === null;

  return (
    <Card title={title} action={info}>
      <div className="grid grid-cols-2 gap-3">
        {range && (
          <StatTile
            className="col-span-2 p-3"
            label="Körperfett"
            value={rangeText(range)}
            unit="%"
            sub={calibration ? <Badge tone="success">kalibriert</Badge> : "aus RFM und US Navy"}
          />
        )}
        <StatTile
          className="p-3"
          label="Taille"
          value={cm(tape.waistCm)}
          unit="cm"
          sub={waistChange === null ? `gemessen am ${shortDate(tape.measuredAt)}` : `${signedCm(waistChange)} cm seit ${shortDate(previousTape!.measuredAt)}`}
        />
        {ratio !== null && <StatTile className="p-3" label="Taille zu Größe" value={ratio.toLocaleString("de-DE", { minimumFractionDigits: 2 })} sub="Richtwert: unter 0,5" />}
        {scaleTile}
      </div>

      {rawRange && (
        <p className="mt-3 text-xs text-text-subtle">
          RFM {rawRange.rfm !== null ? `${percent(rawRange.rfm)} %` : "–"} · US Navy {rawRange.navy !== null ? `${percent(rawRange.navy)} %` : "–"}
          {calibration && ` · verschoben um ${calibration.offsetPercent > 0 ? "+" : "−"}${percent(Math.abs(calibration.offsetPercent))} Prozentpunkte (Referenz vom ${new Date(`${calibration.measuredOn}T12:00:00`).toLocaleDateString("de-DE")})`}
        </p>
      )}
      {(missingNeck || missingHip) && (
        <p className="mt-1 text-xs text-text-subtle">
          {missingHip ? "Ohne Hüfte kann die US-Navy-Formel für Frauen nicht rechnen, daher zählt hier nur RFM." : "Ohne Hals rechnet nur RFM."} Mit allen
          Umfängen wird der Bereich genauer.
        </p>
      )}

      {(belowRange || ffmiImplausible) && measured !== null && (
        <ScaleWarning
          measured={measured}
          ffmi={ffmi}
          ffmiImplausible={ffmiImplausible}
          text={range ? `liegt deutlich unter dem Schätzbereich (${rangeText(range)} %)` : "liegt auffällig niedrig"}
        />
      )}

      <details className="mt-3">
        <summary className="min-h-11 cursor-pointer py-2.5 text-small text-accent-text">
          {calibration ? "Kalibrierung ändern" : "Mit Referenzwert kalibrieren"}
        </summary>
        <BodyFatCalibrationSection />
      </details>
    </Card>
  );
}

function ScaleWarning({ measured, ffmi, ffmiImplausible, text }: { measured: number; ffmi: number | null; ffmiImplausible: boolean; text: string }) {
  return (
    <Callout tone="warning" className="mt-3">
      <p>
        Der Waagenwert ({percent(measured)} %) {text}.
        {ffmiImplausible && ffmi !== null && (
          <>
            {" "}
            Daraus ergäbe sich ein FFMI von {percent(ffmi)} kg/m², mehr als bei natürlich trainierten Menschen üblich ist
            (etwa bis {FFMI_NATURAL_LIMIT}).
          </>
        )}{" "}
        Der Wert ist deshalb vermutlich zu niedrig. Prüf in der Waagen-App, ob ein Athletenmodus aktiv ist. Für den Verlauf
        bleibt die Waage nützlich, solange du gleich misst.
      </p>
      <p className="mt-2 text-xs text-text-subtle">
        Die FFMI-Prüfung gilt nur unter {FFMI_CHECK_MAX_BODY_FAT} % Körperfett. Orientierung, keine medizinische Aussage.
      </p>
    </Callout>
  );
}

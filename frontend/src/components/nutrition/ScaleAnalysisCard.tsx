import { useMemo } from "react";
import { analyzeScaleReadings, type DerivedRow, type NoiseRow } from "@fitnesstracker/shared";
import { useBodyCompositionEntries } from "../../hooks/useBodyComposition";
import { entriesToReadings } from "../../lib/scaleReadings";
import { CalcInfoButton } from "../info/CalcInfoButton";
import { Card } from "../ui";

const fmt = (value: number, digits = 2) => value.toLocaleString("de-DE", { maximumFractionDigits: digits });
const withUnit = (value: number, unit: string, digits = 2) => `${fmt(value, digits)}${unit ? ` ${unit}` : ""}`;

function derivedText(row: DerivedRow): string {
  const evidence = `n = ${row.n}`;
  if (row.relation === "identity") return `${row.label} = ${row.basis} (${evidence})`;
  if (row.relation === "linear") return `${row.label} = ${fmt(row.intercept ?? 0, 0)} + ${fmt(row.slope ?? 0)} × ${row.basis} (R² ${fmt(row.r2 ?? 0, 3)}, ${evidence})`;
  const ratio = row.ratio ?? 0;
  const share = ratio < 1.5 ? `${fmt(ratio * 100, 1)} % von ${row.basis}` : `${fmt(ratio, 1)} × ${row.basis}`;
  return `${row.label} = ${share} (Streuung ${fmt(row.spreadPercent ?? 0)} %, ${evidence})`;
}

function NoiseTable({ rows }: { rows: NoiseRow[] }) {
  return (
    <table className="mt-2 w-full text-small">
      <thead>
        <tr className="text-left text-xs text-text-subtle">
          <th className="py-1 pr-2 font-medium">Wert</th>
          <th className="py-1 pr-2 text-right font-medium">Rauschen (±)</th>
          <th className="py-1 text-right font-medium">größte Abweichung</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className="border-t border-border">
            <td className="py-1 pr-2 text-text-2">{row.label}</td>
            <td className="py-1 pr-2 text-right tabular-nums">{withUnit(row.sd, row.unit)}</td>
            <td className="py-1 text-right tabular-nums text-text-subtle">{withUnit(row.maxRange, row.unit)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// What the stored scale readings reveal about the scale itself: how much its numbers jump between
// weigh-ins minutes apart, and which numbers are no measurements at all but fixed shares of
// another one. Runs on every list refresh; it needs repeated weigh-ins to say anything about noise.
export function ScaleAnalysisCard() {
  const { data: entries } = useBodyCompositionEntries();
  const analysis = useMemo(() => (entries ? analyzeScaleReadings(entriesToReadings(entries)) : null), [entries]);
  if (!analysis || analysis.readings === 0) return null;

  const valueNoise = analysis.noise.filter((n) => n.kind === "value");
  const impedanceNoise = analysis.noise.filter((n) => n.kind === "impedance");
  const fatFreeBased = analysis.derived.filter((d) => d.basis.toLowerCase().includes("fettfreie")).length;
  const fat = analysis.noise.find((n) => n.key === "bodyFatPercent");

  const headline =
    analysis.repeatSessions === 0
      ? "Noch keine Wiederholungsmessung. Wiege dich zwei- bis dreimal hintereinander und lies jeden Bericht ein, dann zeigt sich, wie stark die Werte springen."
      : fat
        ? `Das Körperfett springt zwischen Wiegungen im Abstand von Minuten um etwa ±${fmt(fat.sd, 1)} Punkte (größte Abweichung ${fmt(fat.maxRange, 1)}).`
        : `${analysis.repeatSessions} Wiederholungsmessung(en) ausgewertet.`;

  return (
    <Card title="Waagen-Analyse" action={<CalcInfoButton id="scale-analysis" />}>
      <p className="text-small text-text-2">{headline}</p>
      <p className="mt-1 text-xs text-text-subtle">
        {analysis.readings} {analysis.readings === 1 ? "Messung" : "Messungen"}, davon {analysis.withDetails} mit Bericht
        {analysis.withImpedance > 0 ? ` und Impedanzen (${analysis.withImpedance})` : ""}. Die Trendpfeile oben gelten nur dem Gewicht.
      </p>

      <details className="mt-3">
        <summary className="cursor-pointer text-small text-accent hover:text-accent-hover">Rauschen und Herleitung ansehen</summary>

        <section className="mt-3">
          <h3 className="text-small font-medium text-text">Rauschen bei Wiederholungen</h3>
          {valueNoise.length === 0 ? (
            <p className="mt-1 text-xs text-text-subtle">Dafür fehlen Messungen, die höchstens eine Stunde auseinanderliegen.</p>
          ) : (
            <>
              <NoiseTable rows={valueNoise} />
              <p className="mt-1 text-xs text-text-subtle">
                Aus {analysis.repeatSessions} {analysis.repeatSessions === 1 ? "Sitzung" : "Sitzungen"} mit Wiederholung. Je mehr Wiederholungen, desto verlässlicher die Zahl.
              </p>
            </>
          )}
          {impedanceNoise.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-text-subtle">Rohwerte (Impedanz)</summary>
              <NoiseTable rows={impedanceNoise} />
            </details>
          )}
        </section>

        <section className="mt-4">
          <h3 className="text-small font-medium text-text">Wie die Werte entstehen</h3>
          {analysis.derived.length === 0 ? (
            <p className="mt-1 text-xs text-text-subtle">Dafür braucht es mindestens drei Messungen mit Bericht.</p>
          ) : (
            <>
              {fatFreeBased >= 3 && (
                <p className="mt-1 text-small text-text-2">
                  Mehrere Werte sind feste Anteile derselben Größe, der fettfreien Masse. Sie sind keine eigenen Messungen, ihr
                  Rauschen ist ein einziges. Ein „Muskelverlust“ und „mehr Fett“ sind dann dieselbe Schwankung.
                </p>
              )}
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-text-subtle">
                {analysis.derived.map((row) => (
                  <li key={row.key}>{derivedText(row)}</li>
                ))}
              </ul>
              {analysis.independent.length > 0 && (
                <p className="mt-2 text-xs text-text-subtle">
                  Eigenständig wirken bisher: {analysis.independent.map((i) => i.label).join(", ")}. Mit mehr Messungen lässt sich
                  prüfen, ob auch davon etwas abgeleitet ist.
                </p>
              )}
            </>
          )}
        </section>

        <section className="mt-4">
          <h3 className="text-small font-medium text-text">Was das Körperfett antreibt</h3>
          {analysis.driversNeeded > 0 ? (
            <p className="mt-1 text-xs text-text-subtle">
              Der Zusammenhang mit den einzelnen Impedanzen lässt sich ab sechs Berichten prüfen. Es fehlen noch {analysis.driversNeeded}.
            </p>
          ) : (
            <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-text-subtle">
              {analysis.drivers.map((d) => (
                <li key={d.channelKey}>
                  {d.channelLabel}: Korrelation {fmt(d.r)} mit dem Körperfett
                </li>
              ))}
            </ul>
          )}
        </section>
      </details>
    </Card>
  );
}

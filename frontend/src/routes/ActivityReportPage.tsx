import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { DATA_SOURCE_LABELS, MAX_REPORT_DAYS, type ActivityReportDto, type DataSource } from "@fitnesstracker/shared";
import { useActivityReport } from "../hooks/useActivity";
import { Button, Callout, Field, Input } from "../components/ui";

// "2026-10-08" -> "08.10.2026" without going through Date (no timezone shift on a plain date).
function dayText(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

// Short form for the table cells; the full wording is in the footnote under the tables.
const SOURCE_SHORT: Record<DataSource, string> = { MANUAL: "manuell", IMPORT: "Export", FITBIT: "Fitbit" };

const number = (n: number, digits = 0) =>
  n.toLocaleString("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits });

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

function Sheet({ report }: { report: ActivityReportDto }) {
  const { totals } = report;
  const span = daysBetween(report.from, report.to);
  const fullName = [report.lastName, report.firstName].filter(Boolean).join(", ");
  const sources = [...new Set(report.days.map((d) => d.source))];

  const th = "border-b border-neutral-400 py-1.5 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-600";
  const td = "border-b border-neutral-200 py-1.5 pr-3 text-sm tabular-nums";

  return (
    <article className="mx-auto max-w-3xl bg-white p-6 text-black shadow-lg print:max-w-none print:p-0 print:shadow-none sm:p-10">
      <h1 className="text-2xl font-bold">Aktivitätsnachweis</h1>
      <p className="mt-0.5 text-sm text-neutral-600">Selbst erfasste Bewegungsdaten aus der App „Fitnesstracker“</p>

      <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
        <dt className="font-semibold">Name, Vorname</dt>
        <dd>{fullName || "— bitte in den Einstellungen eintragen —"}</dd>
        <dt className="font-semibold">Zeitraum</dt>
        <dd>
          {dayText(report.from)} – {dayText(report.to)} ({span} Tage)
        </dd>
        <dt className="font-semibold">Erstellt am</dt>
        <dd>{new Date(report.generatedAt).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}</dd>
      </dl>

      <h2 className="mt-7 text-base font-bold">Zusammenfassung</h2>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          ["Schritte gesamt", number(totals.steps)],
          ["Ø Schritte pro Tag mit Daten", number(totals.daysWithSteps ? totals.steps / totals.daysWithSteps : 0)],
          ["Strecke zu Fuß", `${number(totals.stepsDistanceKm, 1)} km`],
          ["Radfahrten", number(totals.bikeSessions)],
          ["Rad-Strecke", `${number(totals.bikeKm, 1)} km`],
          ["Rad-Zeit", `${number(totals.bikeMinutes)} Min.`],
        ].map(([label, value]) => (
          <div key={label} className="rounded border border-neutral-300 p-3">
            <p className="text-xs text-neutral-600">{label}</p>
            <p className="text-lg font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-7 text-base font-bold">Schritte pro Tag</h2>
      {report.days.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-600">Für diesen Zeitraum liegen keine Schrittdaten vor.</p>
      ) : (
        <table className="mt-2 w-full border-collapse">
          <thead>
            <tr>
              <th className={th}>Datum</th>
              <th className={`${th} text-right`}>Schritte</th>
              <th className={`${th} text-right`}>Strecke</th>
              <th className={th}>Quelle</th>
            </tr>
          </thead>
          <tbody>
            {report.days.map((d) => (
              <tr key={d.date} className="break-inside-avoid">
                <td className={`${td} whitespace-nowrap`}>{dayText(d.date)}</td>
                <td className={`${td} text-right`}>{number(d.steps)}</td>
                <td className={`${td} text-right`}>{number(d.distanceKm, 1)} km</td>
                <td className={td}>{SOURCE_SHORT[d.source]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 className="mt-7 text-base font-bold">Radfahrten</h2>
      {report.bikeSessions.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-600">Für diesen Zeitraum sind keine Radfahrten erfasst.</p>
      ) : (
        <table className="mt-2 w-full border-collapse">
          <thead>
            <tr>
              <th className={th}>Datum</th>
              <th className={`${th} text-right`}>Dauer</th>
              <th className={`${th} text-right`}>Strecke</th>
              <th className={th}>Quelle</th>
            </tr>
          </thead>
          <tbody>
            {report.bikeSessions.map((b) => (
              <tr key={b.performedAt} className="break-inside-avoid">
                <td className={`${td} whitespace-nowrap`}>{new Date(b.performedAt).toLocaleDateString("de-DE")}</td>
                <td className={`${td} whitespace-nowrap text-right`}>{b.durationMinutes} Min.</td>
                <td className={`${td} text-right`}>{b.distanceKm === null ? "–" : `${number(b.distanceKm, 1)} km`}</td>
                <td className={td}>{SOURCE_SHORT[b.source]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="mt-5 text-xs text-neutral-600">
        Quelle: manuell = von Hand eingetragen, Export = aus einer Datei der Gesundheits-App übernommen, Fitbit = automatisch vom Gerät aufgezeichnet. Schrittdaten dieses Zeitraums: {sources.length ? sources.map((s) => DATA_SOURCE_LABELS[s]).join(", ") : "–"}.
        {totals.manualBikeSessions > 0 &&
          ` ${totals.manualBikeSessions} von ${totals.bikeSessions} Radfahrten wurden von Hand eingetragen.`}
      </p>

      <section className="mt-8 break-inside-avoid border-t border-neutral-400 pt-4">
        <p className="text-sm">Ich bestätige, dass die oben genannten Daten meine eigenen sind und von mir stammen.</p>
        <div className="mt-10 grid grid-cols-2 gap-8 text-xs text-neutral-600">
          <p className="border-t border-neutral-500 pt-1">Ort, Datum</p>
          <p className="border-t border-neutral-500 pt-1">Unterschrift</p>
        </div>
      </section>
    </article>
  );
}

// Printable proof of activity (steps per day + bike sessions) for the last four weeks by default.
// Stands alone without the app shell so a screenshot or "Print → Save as PDF" contains only the
// report. Lives outside AppShell on purpose.
export function ActivityReportPage() {
  const [range, setRange] = useState<{ from?: string; to?: string }>({});
  const [draft, setDraft] = useState<{ from: string; to: string }>({ from: "", to: "" });
  const { data: report, isLoading, isError } = useActivityReport(range);

  const rangeTooLong = draft.from && draft.to && daysBetween(draft.from, draft.to) > MAX_REPORT_DAYS;
  const rangeReversed = draft.from && draft.to && draft.from > draft.to;

  return (
    <div className="min-h-screen bg-bg px-4 py-4 pb-[env(safe-area-inset-bottom)] print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-3xl flex-col gap-3 print:hidden">
        <div className="flex items-center justify-between gap-2">
          <Link to="/settings" className="inline-flex items-center gap-1 text-small text-accent-text">
            <ArrowLeft size={16} aria-hidden /> Einstellungen
          </Link>
          <Button variant="primary" iconLeft={<Printer size={16} aria-hidden />} onClick={() => window.print()}>
            Drucken / als PDF speichern
          </Button>
        </div>
        <form
          className="grid grid-cols-2 items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (rangeTooLong || rangeReversed) return;
            setRange({ from: draft.from || undefined, to: draft.to || undefined });
          }}
        >
          <Field label="Von" className="min-w-0">{(p) => <Input {...p} type="date" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />}</Field>
          <Field label="Bis" className="min-w-0">{(p) => <Input {...p} type="date" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />}</Field>
          <Button type="submit" variant="secondary" className="col-span-2" disabled={!!rangeTooLong || !!rangeReversed}>
            Anzeigen
          </Button>
        </form>
        <p className="text-xs text-text-faint">Ohne Datum: die letzten 4 Wochen. Höchstens {MAX_REPORT_DAYS} Tage.</p>
        {(rangeTooLong || rangeReversed) && (
          <Callout tone="danger">
            {rangeReversed ? "„Von“ liegt nach „Bis“." : `Der Zeitraum darf höchstens ${MAX_REPORT_DAYS} Tage umfassen.`}
          </Callout>
        )}
        {report && !report.firstName && !report.lastName && (
          <Callout tone="info">
            Es ist noch kein Name hinterlegt. Trage Name und Vorname in den <Link to="/settings" className="underline">Einstellungen</Link> ein.
          </Callout>
        )}
      </div>

      {isLoading && <p className="text-center text-text-subtle print:hidden">Lädt…</p>}
      {isError && (
        <Callout tone="danger" className="mx-auto max-w-3xl">
          Der Nachweis konnte nicht geladen werden. Bist du online?
        </Callout>
      )}
      {report && <Sheet report={report} />}
    </div>
  );
}

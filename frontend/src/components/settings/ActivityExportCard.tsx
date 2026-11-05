import { useState } from "react";
import { FileText, FileJson } from "lucide-react";
import { useExportActivity } from "../../hooks/useActivity";
import { CalcInfoButton } from "../info/CalcInfoButton";
import { Button, Callout, Card, SegmentedControl } from "../ui";

const RANGES = [4, 8, 12, 26] as const;
type Weeks = (typeof RANGES)[number];

// Weekly report of training load, steps and cycling. The JSON is for processing (records shaped
// like a health export plus a summary per week); the PDF is the overview to read.
export function ActivityExportCard() {
  const [weeks, setWeeks] = useState<Weeks>(8);
  const exportActivity = useExportActivity();
  const busy = exportActivity.isPending;
  const pendingFormat = exportActivity.variables?.format;

  return (
    <Card title="Aktivitätsbericht" action={<CalcInfoButton id="activity-report" />}>
      <p className="text-small text-text-subtle">
        Pro Woche: Krafttraining aus dem Verlauf, Schritte je Tag mit Summe und Durchschnitt, Fahrrad draußen und im Studio.
      </p>

      <SegmentedControl
        label="Zeitraum in Wochen"
        className="mt-3"
        value={String(weeks) as `${Weeks}`}
        onChange={(value) => setWeeks(Number(value) as Weeks)}
        options={RANGES.map((w) => ({ value: String(w) as `${Weeks}`, label: `${w} Wo.` }))}
      />

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Button
          variant="primary"
          iconLeft={<FileText size={16} aria-hidden />}
          disabled={busy}
          onClick={() => exportActivity.mutate({ format: "pdf", weeks })}
        >
          {busy && pendingFormat === "pdf" ? "Erstelle PDF…" : "Übersicht (PDF)"}
        </Button>
        <Button
          variant="secondary"
          iconLeft={<FileJson size={16} aria-hidden />}
          disabled={busy}
          onClick={() => exportActivity.mutate({ format: "json", weeks })}
        >
          {busy && pendingFormat === "json" ? "Erstelle JSON…" : "Daten (JSON)"}
        </Button>
      </div>

      {exportActivity.isError && (
        <Callout tone="danger" className="mt-3">
          Export fehlgeschlagen. Bitte erneut versuchen.
        </Callout>
      )}
    </Card>
  );
}

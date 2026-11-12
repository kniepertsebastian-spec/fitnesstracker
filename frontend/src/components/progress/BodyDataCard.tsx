import { Link } from "react-router-dom";
import { Camera, ChevronRight } from "lucide-react";
import { useBodyCompositionEntries } from "../../hooks/useBodyComposition";
import { useProgressPhotos } from "../../hooks/useProgressPhotos";
import { rangeCutoff, type ProgressRange } from "../../lib/progressRange";
import { formatDelta } from "../../lib/stats";
import { weightTrendAt } from "../../lib/weightTrend";
import { ButtonLink, Card, StatTile } from "../ui";

// Body data for the selected range: latest value and the change since the first measurement in
// range. Entering a measurement stays on the Nutrition page's "Körper" tab (its form lives there).
export function BodyDataCard({ range }: { range: ProgressRange }) {
  const { data: entries } = useBodyCompositionEntries();
  const { data: photos } = useProgressPhotos();

  const cutoff = rangeCutoff(range);
  // API returns newest first — chronological for first-vs-last.
  const inRange = (entries ?? [])
    .filter((e) => !cutoff || new Date(e.measuredAt) >= cutoff)
    .slice()
    .reverse();
  const all = entries ?? [];

  // Latest value and the change since the first value in range. Values missing on a measurement
  // (a weigh-in without tape, a tape without scale fat) are skipped instead of showing "–".
  const metric = (
    label: string,
    unit: string,
    pick: (e: (typeof inRange)[number]) => number | null,
    digits = 1,
  ) => {
    const withValue = inRange.filter((e) => pick(e) !== null);
    const first = withValue[0];
    const last = withValue.at(-1);
    const value = last ? pick(last) : null;
    const base = first && first !== last ? pick(first) : null;
    return (
      <StatTile
        label={label}
        value={value !== null ? value.toLocaleString("de-DE", { maximumFractionDigits: digits }) : "–"}
        unit={value !== null ? unit : undefined}
        // A change in a percentage is in percentage points, not "%".
        sub={value !== null && base !== null ? `${formatDelta(value - base, digits)} ${unit === "%" ? "Prozentpunkte" : unit}` : undefined}
        className="p-3"
      />
    );
  };

  const lastPhoto = photos?.[0];

  return (
    <Card
      title="Körperdaten"
      action={
        <ButtonLink to="/nutrition?tab=koerper" size="sm" variant="secondary">
          Messung eintragen
        </ButtonLink>
      }
    >
      {inRange.length === 0 ? (
        <p className="text-small text-text-subtle">Keine Messungen in diesem Zeitraum.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {/* Weight as the 7-day mean: single weigh-ins jump with water and food. */}
          {metric("Gewicht (Ø 7 Tage)", "kg", (e) => weightTrendAt(all, e.measuredAt))}
          {metric("Taille", "cm", (e) => e.waistCm)}
          {metric("Körperfett (Waage)", "%", (e) => e.bodyFatPercent)}
          {metric("Muskelmasse", "kg", (e) => e.muscleMassKg)}
        </div>
      )}
      <Link
        to="/nutrition?tab=koerper"
        className="mt-3 flex min-h-[52px] items-center gap-3 border-t border-border-subtle pt-3 text-body text-text hover:text-accent-text"
      >
        <Camera size={18} aria-hidden className="text-text-subtle" />
        <span className="flex-1">Fortschrittsfotos</span>
        <span className="text-small text-text-faint">
          {lastPhoto
            ? `zuletzt ${new Date(lastPhoto.takenAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}`
            : "noch keine"}
        </span>
        <ChevronRight size={16} aria-hidden className="text-text-faint" />
      </Link>
    </Card>
  );
}

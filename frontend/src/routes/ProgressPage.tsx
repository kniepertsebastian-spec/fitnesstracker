import { useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { RangeTabs } from "../components/progress/RangeTabs";
import { WeightProgressCard } from "../components/progress/WeightProgressCard";
import { StrengthProgressCard } from "../components/progress/StrengthProgressCard";
import { VolumeProgressCard } from "../components/progress/VolumeProgressCard";
import type { ProgressRange } from "../lib/progressRange";

// roadmap2.md P1.2: "Fortschrittsansicht abrunden – Gewicht, Körperdaten, Kraft, Volumen, PRs
// und Zeiträume." Pure frontend aggregation over data that's already fetched elsewhere (body
// composition, workout logs via the existing offline-first cache) — no new backend endpoints,
// a single range selection drives every card on the page.
export function ProgressPage() {
  const [range, setRange] = useState<ProgressRange>("3m");

  return (
    <AppShell>
      <h1 className="mb-4 text-xl font-semibold">Fortschritt</h1>
      <RangeTabs selected={range} onSelect={setRange} />
      <div className="flex flex-col gap-4">
        <WeightProgressCard range={range} />
        <StrengthProgressCard range={range} />
        <VolumeProgressCard range={range} />
      </div>
    </AppShell>
  );
}

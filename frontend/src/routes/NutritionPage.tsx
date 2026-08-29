import { useSearchParams } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { PageTabs } from "../components/layout/PageTabs";
import { ProfileForm } from "../components/nutrition/ProfileForm";
import { SupplementCard } from "../components/nutrition/SupplementCard";
import { BodyCompositionCard } from "../components/nutrition/BodyCompositionCard";
import { ProgressPhotosCard } from "../components/nutrition/ProgressPhotosCard";

const TABS = [
  { key: "rechner", label: "Rechner" },
  { key: "koerper", label: "Körper" },
  { key: "supplements", label: "Supplements" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

// The tab is a URL param (?tab=…), not just component state — that makes each section directly
// linkable (e.g. a future push notification could open straight to "supplements") and gives
// proper browser back/forward behavior between tabs, not just "reload resets to the first one".
export function NutritionPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const tab: TabKey = TABS.some((t) => t.key === requestedTab) ? (requestedTab as TabKey) : "rechner";

  return (
    <AppShell>
      <h1 className="mb-4 text-xl font-semibold">Ernährung</h1>

      <PageTabs tabs={TABS} active={tab} onChange={(key) => setSearchParams({ tab: key })} />

      {tab === "rechner" && <ProfileForm />}
      {tab === "koerper" && (
        <div className="flex flex-col gap-6">
          <BodyCompositionCard />
          <div>
            <h2 className="mb-2 text-sm font-medium text-ink-400">Fortschritts-Fotos</h2>
            <ProgressPhotosCard />
          </div>
        </div>
      )}
      {tab === "supplements" && <SupplementCard />}
    </AppShell>
  );
}

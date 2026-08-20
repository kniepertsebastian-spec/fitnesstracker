import { useSearchParams } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { PageTabs } from "../components/layout/PageTabs";
import { ProfileForm } from "../components/nutrition/ProfileForm";
import { WaterCard } from "../components/nutrition/WaterCard";
import { SupplementCard } from "../components/nutrition/SupplementCard";
import { SupplementReferenceList } from "../components/nutrition/SupplementReferenceList";
import { BodyCompositionCard } from "../components/nutrition/BodyCompositionCard";
import { NUTRITION_TIPS } from "../data/nutritionTips";

const TABS = [
  { key: "rechner", label: "Rechner" },
  { key: "wasser", label: "Wasser" },
  { key: "koerper", label: "Körper" },
  { key: "supplements", label: "Supplements" },
  { key: "tipps", label: "Tipps" },
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
      {tab === "wasser" && <WaterCard />}
      {tab === "koerper" && <BodyCompositionCard />}
      {tab === "supplements" && <SupplementCard />}
      {tab === "tipps" && (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="mb-2 text-sm font-medium text-ink-400">Tipps & Tricks</h2>
            <ul className="flex flex-col gap-2">
              {NUTRITION_TIPS.map((tip) => (
                <li
                  key={tip}
                  className="rounded-lg border border-ink-800 bg-ink-900 p-3 text-sm text-ink-300"
                >
                  {tip}
                </li>
              ))}
            </ul>
          </div>
          <SupplementReferenceList />
        </div>
      )}
    </AppShell>
  );
}

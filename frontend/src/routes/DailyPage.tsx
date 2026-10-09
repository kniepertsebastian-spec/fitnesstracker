import { AppShell } from "../components/layout/AppShell";
import { CardioCard } from "../components/daily/CardioCard";
import { ChallengeCard } from "../components/daily/ChallengeCard";
import { StretchCard } from "../components/daily/StretchCard";

// Everything that resets each day and is independent of the training plan: challenge, stretch
// routine, cardio. Kept apart from the diary so the training table isn't buried under it.
export function DailyPage() {
  return (
    <AppShell>
      <h1 className="mb-5 text-h1 text-text lg:text-h1-lg">Daily</h1>
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start">
        <ChallengeCard />
        <CardioCard />
        <div className="lg:col-span-2">
          <StretchCard />
        </div>
      </div>
    </AppShell>
  );
}

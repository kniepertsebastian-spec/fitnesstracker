import { AppShell } from "../components/layout/AppShell";
import { DailyChallengeCard } from "../components/workoutLog/DailyChallengeCard";
import { DailyStretchCard } from "../components/stretching/DailyStretchCard";
import { CardioLogCard } from "../components/workoutLog/CardioLogCard";

// Everything that resets each day and is independent of the training plan: challenge, stretch
// routine, cardio. Kept apart from the diary so the training table isn't buried under it.
export function DailyPage() {
  return (
    <AppShell>
      <h1 className="mb-4 text-xl font-semibold">Daily</h1>
      <div className="flex flex-col gap-4">
        <DailyChallengeCard />
        <DailyStretchCard />
        <CardioLogCard />
      </div>
    </AppShell>
  );
}

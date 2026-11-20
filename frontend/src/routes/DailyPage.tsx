import { AppShell } from "../components/layout/AppShell";
import { ChallengeCard } from "../components/daily/ChallengeCard";
import { DailyTrainingCard } from "../components/daily/DailyTrainingCard";
import { StretchCard } from "../components/daily/StretchCard";

// Everything that resets each day and needs no equipment or training day: challenge and stretch
// routine, plus the Daily phase of the plan. Cardio moved into the plan and the training view (F9).
export function DailyPage() {
  return (
    <AppShell>
      <h1 className="mb-5 text-h1 text-text lg:text-h1-lg">Daily</h1>
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start">
        <DailyTrainingCard />
        <ChallengeCard />
        <StretchCard />
      </div>
    </AppShell>
  );
}

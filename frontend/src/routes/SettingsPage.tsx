import { AppShell } from "../components/layout/AppShell";
import { AiKeyCard } from "../components/settings/AiKeyCard";
import { DataExportCard } from "../components/settings/DataExportCard";
import { TimerSettingsCard } from "../components/settings/TimerSettingsCard";
import { PushReminderCard } from "../components/trainingPlan/PushReminderCard";

export function SettingsPage() {
  return (
    <AppShell>
      <h1 className="mb-5 text-h1 text-text lg:text-h1-lg">Einstellungen</h1>
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start">
        <TimerSettingsCard />
        <PushReminderCard />
        <AiKeyCard />
        <DataExportCard />
      </div>
    </AppShell>
  );
}

import { AppShell } from "../components/layout/AppShell";
import { ActivityExportCard } from "../components/settings/ActivityExportCard";
import { ActivityReportCard } from "../components/settings/ActivityReportCard";
import { AccountCard } from "../components/settings/AccountCard";
import { AiKeyCard } from "../components/settings/AiKeyCard";
import { CalculationsCard } from "../components/settings/CalculationsCard";
import { DataExportCard } from "../components/settings/DataExportCard";
import { HealthImportCard } from "../components/settings/HealthImportCard";
import { HealthSyncCard } from "../components/settings/HealthSyncCard";
import { TimerSettingsCard } from "../components/settings/TimerSettingsCard";
import { PushReminderCard } from "../components/trainingPlan/PushReminderCard";

export function SettingsPage() {
  return (
    <AppShell>
      <h1 className="mb-5 text-h1 text-text lg:text-h1-lg">Einstellungen</h1>
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start">
        <AccountCard />
        <TimerSettingsCard />
        <PushReminderCard />
        <AiKeyCard />
        <ActivityReportCard />
        <HealthImportCard />
        <HealthSyncCard />
        <ActivityExportCard />
        <DataExportCard />
        <CalculationsCard />
      </div>
    </AppShell>
  );
}

import { AppShell } from "../components/layout/AppShell";
import { DataExportCard } from "../components/settings/DataExportCard";
import { LanguageCard } from "../components/settings/LanguageCard";

export function SettingsPage() {
  return (
    <AppShell>
      <h1 className="mb-4 text-xl font-semibold">Einstellungen</h1>
      <div className="flex flex-col gap-4">
        <LanguageCard />
        <DataExportCard />
      </div>
    </AppShell>
  );
}

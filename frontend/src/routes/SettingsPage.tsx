import { AppShell } from "../components/layout/AppShell";
import { DataExportCard } from "../components/settings/DataExportCard";

export function SettingsPage() {
  return (
    <AppShell>
      <h1 className="mb-4 text-xl font-semibold">Einstellungen</h1>
      <div className="flex flex-col gap-4">
        <DataExportCard />
      </div>
    </AppShell>
  );
}

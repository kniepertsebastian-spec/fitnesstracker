import { TimerSettingsForm } from "./TimerSettingsForm";

export function TimerSettingsCard() {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="mb-3 text-sm font-medium text-text-muted">Satzpausen-Timer</p>
      <TimerSettingsForm />
    </div>
  );
}

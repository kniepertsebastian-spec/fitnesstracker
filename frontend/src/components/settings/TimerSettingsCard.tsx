import { TimerSettingsForm } from "./TimerSettingsForm";

export function TimerSettingsCard() {
  return (
    <div className="rounded-lg border border-ink-800 bg-ink-900 p-4">
      <p className="mb-3 text-sm font-medium text-ink-300">Satzpausen-Timer</p>
      <TimerSettingsForm />
    </div>
  );
}

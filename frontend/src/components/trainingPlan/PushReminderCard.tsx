import type { PushSettingsDto } from "@fitnesstracker/shared";
import { usePushSubscription } from "../../hooks/usePushSubscription";
import { usePushSettings, useUpdatePushSettings } from "../../hooks/usePushSettings";

const REMINDER_TYPES: { key: keyof PushSettingsDto; label: string }[] = [
  { key: "remindPhaseChange", label: "Trainingsplan-Phasenwechsel" },
  { key: "remindSupplements", label: "Supplement-Erinnerungen" },
  { key: "remindProgressPhoto", label: "Fortschritts-Foto (wöchentlich)" },
];

// Was originally scoped to just the phase-change reminder — but the underlying browser push
// subscription is a single endpoint shared by every reminder kind this app sends (phase change,
// supplements, progress photos), so subscribing here always opted into all three regardless of
// what the card's copy implied, with no way to turn off just one (roadmap2.md P1.4: "Erinnerungen
// individuell aktivierbar und konfigurierbar"). Reworked into a general push-settings card:
// the master subscribe/unsubscribe toggle controls whether push can reach this device at all,
// the three checkboxes below (only shown once actually subscribed — a preference for a
// notification kind that can't be delivered yet is just noise) control which kinds you get.
export function PushReminderCard() {
  const { status, error, subscribe, unsubscribe } = usePushSubscription();
  const { data: settings } = usePushSettings();
  const updateSettings = useUpdatePushSettings();

  if (status === "loading" || status === "unsupported") return null;

  return (
    <div className="rounded-lg border border-ink-800 bg-ink-900 p-4">
      <p className="text-sm font-medium text-ink-300">Push-Benachrichtigungen</p>
      <p className="mt-1 text-sm text-ink-500">
        Erinnerungen direkt aufs Gerät, auch wenn die App gerade nicht offen ist.
      </p>

      {status === "unconfigured" ? (
        <p className="mt-2 text-sm text-ink-600">
          Server hat noch keinen VAPID-Schlüssel konfiguriert.
        </p>
      ) : (
        <>
          <button
            onClick={status === "subscribed" ? unsubscribe : subscribe}
            className={`mt-3 w-full rounded-lg py-1.5 text-sm font-medium ${
              status === "subscribed"
                ? "bg-ink-800 text-ink-300 hover:bg-ink-700"
                : "bg-violet-500 text-ink-950 hover:bg-violet-400"
            }`}
          >
            {status === "subscribed" ? "Benachrichtigungen deaktivieren" : "Benachrichtigungen aktivieren"}
          </button>

          {status === "subscribed" && settings && (
            <div className="mt-3 flex flex-col gap-2 border-t border-ink-800 pt-3">
              {REMINDER_TYPES.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-sm text-ink-300">
                  <input
                    type="checkbox"
                    checked={settings[key]}
                    onChange={(e) => updateSettings.mutate({ [key]: e.target.checked })}
                    className="h-4 w-4 accent-violet-500"
                  />
                  {label}
                </label>
              ))}
            </div>
          )}
        </>
      )}

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}

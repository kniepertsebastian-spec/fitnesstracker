import type { PushSettingsDto } from "@fitnesstracker/shared";
import { usePushSubscription } from "../../hooks/usePushSubscription";
import { usePushSettings, useUpdatePushSettings } from "../../hooks/usePushSettings";

interface ReminderType {
  key: keyof PushSettingsDto;
  label: string;
  // Shown only for categories with no current sender — see the User model's schema comment
  // (schema.prisma) for why: a sync failure is already known locally while the app is open, and
  // app-update pushes need a deploy-triggered broadcast mechanism this app doesn't have yet.
  note?: string;
}

// Grouped to match the additionals-roadmap P1.7 category structure (Training/Progress/
// Challenges/System) — "der Nutzer entscheidet selbst, welche Kategorien aktiviert sind".
const REMINDER_GROUPS: { title: string; types: ReminderType[] }[] = [
  {
    title: "Training",
    types: [
      { key: "remindPhaseChange", label: "Trainingsplan-Phasenwechsel" },
      { key: "remindWorkout", label: "Erinnerung: heute noch nicht trainiert" },
      { key: "remindSupplements", label: "Supplement-Erinnerungen" },
    ],
  },
  {
    title: "Fortschritt",
    types: [
      { key: "remindPersonalRecords", label: "Neue Rekorde (Gewicht/Wdh.)" },
      { key: "remindGoalAchievements", label: "Ziel erreicht" },
      { key: "remindProgressPhoto", label: "Fortschritts-Foto (wöchentlich)" },
    ],
  },
  {
    title: "Challenges",
    types: [{ key: "remindDailyChallenge", label: "Tages-Challenge nicht abgeschlossen" }],
  },
  {
    title: "System",
    types: [
      { key: "remindSyncErrors", label: "Synchronisierungs-Fehler", note: "noch ohne Push-Versand" },
      { key: "remindAppUpdates", label: "Wichtige App-Updates", note: "noch ohne Push-Versand" },
    ],
  },
];

// Was originally scoped to just the phase-change reminder — but the underlying browser push
// subscription is a single endpoint shared by every reminder kind this app sends, so subscribing
// here always opted into all of them regardless of what the card's copy implied, with no way to
// turn off just one. Reworked into a general push-settings card: the master subscribe/unsubscribe
// toggle controls whether push can reach this device at all, the checkboxes below (only shown
// once actually subscribed — a preference for a notification kind that can't be delivered yet is
// just noise) control which kinds you get, grouped by category.
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
            <div className="mt-3 flex flex-col gap-3 border-t border-ink-800 pt-3">
              {REMINDER_GROUPS.map((group) => (
                <div key={group.title}>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-600">
                    {group.title}
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {group.types.map(({ key, label, note }) => (
                      <label key={key} className="flex items-center gap-2 text-sm text-ink-300">
                        <input
                          type="checkbox"
                          checked={settings[key]}
                          onChange={(e) => updateSettings.mutate({ [key]: e.target.checked })}
                          className="h-4 w-4 accent-violet-500"
                        />
                        <span>
                          {label}
                          {note && <span className="text-ink-600"> ({note})</span>}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}

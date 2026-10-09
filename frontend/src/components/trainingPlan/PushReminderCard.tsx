import type { PushSettingsDto } from "@fitnesstracker/shared";
import { usePushSubscription } from "../../hooks/usePushSubscription";
import { usePushSettings, useUpdatePushSettings } from "../../hooks/usePushSettings";
import { Button, Callout, Card, Toggle } from "../ui";

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
    <Card title="Benachrichtigungen">
      <p className="text-small text-text-subtle">
        Erinnerungen direkt aufs Gerät, auch wenn die App gerade nicht offen ist.
      </p>

      {status === "unconfigured" ? (
        <p className="mt-2 text-small text-text-faint">Server hat noch keinen VAPID-Schlüssel konfiguriert.</p>
      ) : (
        <>
          <Button
            variant={status === "subscribed" ? "secondary" : "primary"}
            fullWidth
            className="mt-3"
            onClick={status === "subscribed" ? unsubscribe : subscribe}
          >
            {status === "subscribed" ? "Benachrichtigungen deaktivieren" : "Benachrichtigungen aktivieren"}
          </Button>

          {status === "subscribed" && settings && (
            <div className="mt-3 flex flex-col gap-3 border-t border-border-subtle pt-3">
              {REMINDER_GROUPS.map((group) => (
                <div key={group.title}>
                  <p className="mb-1 text-overline uppercase text-text-faint">{group.title}</p>
                  <div className="flex flex-col">
                    {group.types.map(({ key, label, note }) => (
                      <Toggle
                        key={key}
                        label={label}
                        hint={note}
                        checked={settings[key]}
                        onChange={(checked) => updateSettings.mutate({ [key]: checked })}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {error && (
        <Callout tone="danger" className="mt-3">
          {error}
        </Callout>
      )}
    </Card>
  );
}

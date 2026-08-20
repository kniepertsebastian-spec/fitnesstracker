import { usePushSubscription } from "../../hooks/usePushSubscription";

export function PushReminderCard() {
  const { status, error, subscribe, unsubscribe } = usePushSubscription();

  if (status === "loading" || status === "unsupported") return null;

  return (
    <div className="rounded-lg border border-ink-800 bg-ink-900 p-4">
      <p className="text-sm font-medium text-ink-300">Erinnerung bei Phasenwechsel</p>
      <p className="mt-1 text-sm text-ink-500">
        Push-Benachrichtigung, sobald der Trainingsplan automatisch in die nächste Phase wechselt.
      </p>

      {status === "unconfigured" ? (
        <p className="mt-2 text-sm text-ink-600">
          Server hat noch keinen VAPID-Schlüssel konfiguriert.
        </p>
      ) : (
        <button
          onClick={status === "subscribed" ? unsubscribe : subscribe}
          className={`mt-3 w-full rounded-lg py-1.5 text-sm font-medium ${
            status === "subscribed"
              ? "bg-ink-800 text-ink-300 hover:bg-ink-700"
              : "bg-violet-500 text-ink-950 hover:bg-violet-400"
          }`}
        >
          {status === "subscribed" ? "Erinnerungen deaktivieren" : "Erinnerungen aktivieren"}
        </button>
      )}

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}

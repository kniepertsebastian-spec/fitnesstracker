import { useState } from "react";
import { Check, Copy, Link2, RefreshCw, Unlink } from "lucide-react";
import { useCreateHealthSyncToken, useHealthSyncStatus, useRevokeHealthSyncToken } from "../../hooks/useActivity";
import { CalcInfoButton } from "../info/CalcInfoButton";
import { Button, Callout, Card, Skeleton } from "../ui";

const COMPANION_URL = "https://github.com/owen282000/life-dashboard-companion-app";

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const day = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("de-DE");

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied; the value stays selectable below.
    }
  };
  return (
    <div className="mt-2">
      <p className="text-xs text-text-subtle">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <code className="min-w-0 flex-1 select-all break-all rounded-md border border-border bg-surface-inset px-2 py-1.5 text-xs text-text-2">
          {value}
        </code>
        <Button variant="secondary" size="sm" aria-label={`${label} kopieren`} onClick={() => void copy()}>
          {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
        </Button>
      </div>
    </div>
  );
}

// Health Connect is an on-device API of Android: a web app cannot read it. A small companion app
// on the phone reads it (steps, distance, exercise sessions) and posts the data to the webhook of
// this app, authenticated with the token created here. Only a hash of the token is stored.
export function HealthSyncCard() {
  const { data: status, isLoading } = useHealthSyncStatus();
  const createToken = useCreateHealthSyncToken();
  const revoke = useRevokeHealthSyncToken();
  const [token, setToken] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const webhookUrl = `${window.location.origin}/api/health-sync/webhook`;

  const create = async () => {
    setToken(null);
    try {
      const result = await createToken.mutateAsync();
      setToken(result.token);
    } catch {
      // The error callout below reports it.
    }
  };

  const disconnect = async () => {
    try {
      await revoke.mutateAsync();
      setToken(null);
      setConfirmRevoke(false);
    } catch {
      // The error callout below reports it.
    }
  };

  return (
    <Card title="Health Connect (Schritte & Rad)" action={<CalcInfoButton id="activity-report" />}>
      <p className="text-small text-text-subtle">
        Schritte und Radfahrten holt eine kleine Android-App aus Health Connect und schickt sie automatisch an diese App. Eine
        Web-App kann Health Connect nicht selbst lesen.
      </p>

      {isLoading || !status ? (
        <Skeleton className="mt-3 h-16 w-full" />
      ) : (
        <div className="mt-3 text-small text-text-2">
          {status.connected ? (
            <>
              <p>
                {status.lastUsedAt
                  ? `Letzte Übertragung: ${dateTime(status.lastUsedAt)}`
                  : "Verbindung eingerichtet, es sind noch keine Daten angekommen."}
              </p>
              <p className="text-text-subtle">
                {status.daysStored > 0 && status.firstDay && status.lastDay
                  ? `${status.daysStored} Tage gespeichert (${day(status.firstDay)} – ${day(status.lastDay)}), ${status.ridesStored} Radfahrten`
                  : "Noch keine Tage gespeichert."}
              </p>
            </>
          ) : (
            <p>Noch nicht verbunden.</p>
          )}
        </div>
      )}

      {token && (
        <Callout tone="warning" className="mt-3">
          <p className="font-medium">Dieses Token wird nur jetzt angezeigt.</p>
          <p className="mt-1">Trag beides in der Android-App ein. Ein neues Token macht das alte ungültig.</p>
          <CopyRow label="Webhook-URL" value={webhookUrl} />
          <CopyRow label="Header „Authorization“" value={`Bearer ${token}`} />
        </Callout>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant={status?.connected ? "secondary" : "primary"}
          iconLeft={status?.connected ? <RefreshCw size={16} aria-hidden /> : <Link2 size={16} aria-hidden />}
          disabled={createToken.isPending || revoke.isPending}
          onClick={() => void create()}
        >
          {status?.connected ? "Neues Token erzeugen" : "Verbindung einrichten"}
        </Button>
        {status?.connected &&
          (confirmRevoke ? (
            <>
              <Button variant="danger" disabled={revoke.isPending} onClick={() => void disconnect()}>
                Wirklich trennen
              </Button>
              <Button variant="ghost" onClick={() => setConfirmRevoke(false)}>
                Abbrechen
              </Button>
            </>
          ) : (
            <Button variant="ghost" iconLeft={<Unlink size={16} aria-hidden />} onClick={() => setConfirmRevoke(true)}>
              Trennen
            </Button>
          ))}
      </div>

      {(createToken.isError || revoke.isError) && (
        <Callout tone="danger" className="mt-3">
          Das hat nicht geklappt. Bitte erneut versuchen.
        </Callout>
      )}

      <details className="mt-4 text-small text-text-subtle">
        <summary className="cursor-pointer text-text-2">So richtest du die Android-App ein</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>
            „Life Dashboard Companion“ installieren (
            <a className="text-accent hover:text-accent-hover" href={COMPANION_URL} target="_blank" rel="noreferrer">
              GitHub
            </a>
            : kostenlos per APK, F-Droid oder Obtainium; im Play Store kostet sie einmalig etwa 5 €).
          </li>
          <li>Health Connect erlauben für Schritte, Distanz und Trainingseinheiten.</li>
          <li>Einen Webhook anlegen: oben die URL und den Header „Authorization“ mit dem Token eintragen. Ein Signatur-Geheimnis ist nicht nötig.</li>
          <li>Intervall wählen, optional den Verlauf nachladen, und mit „Test“ prüfen. Hier erscheint danach die letzte Übertragung.</li>
        </ol>
        <p className="mt-2 text-xs">
          Namen in der App können je nach Version abweichen. Übernommen werden die Tagessummen der Schritte und Radfahrten
          draußen (Health-Connect-Typ „Radfahren“). Hometrainer-Einheiten zählen nicht, sie stehen im Cardio-Log.
        </p>
      </details>
    </Card>
  );
}

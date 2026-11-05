import { useState } from "react";
import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { updateNameRequest } from "../../api/auth.api";
import { useAuthStore } from "../../stores/authStore";
import { Button, Callout, Card, Field, Input } from "../ui";

// Name for the printable activity report ("Name, Vorname"), plus the way to it. The nickname from
// registration stays as it is — this is the real name an insurer expects on a proof.
export function ActivityReportCard() {
  const user = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);
  const queryClient = useQueryClient();
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "info" | "danger"; text: string } | null>(null);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    setMessage(null);
    try {
      const updated = await updateNameRequest({
        firstName: firstName.trim() || null,
        lastName: lastName.trim() || null,
      });
      // Keep the in-memory session's token; only the user data changed.
      setSession(updated, useAuthStore.getState().accessToken ?? "");
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
      setMessage({ tone: "info", text: "Name gespeichert." });
    } catch {
      setMessage({ tone: "danger", text: "Speichern fehlgeschlagen — bitte erneut versuchen." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Aktivitätsnachweis">
      <p className="text-small text-text-subtle">
        Schritte pro Tag und Radfahrten der letzten 4 Wochen als Übersicht zum Ausdrucken, als PDF oder als Screenshot,
        z. B. für das Bonusprogramm deiner Krankenkasse.
      </p>
      <form
        className="mt-3 grid grid-cols-2 gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field label="Name">
          {(p) => <Input {...p} autoComplete="family-name" maxLength={80} value={lastName} onChange={(e) => setLastName(e.target.value)} />}
        </Field>
        <Field label="Vorname">
          {(p) => <Input {...p} autoComplete="given-name" maxLength={80} value={firstName} onChange={(e) => setFirstName(e.target.value)} />}
        </Field>
        <div className="col-span-2 flex flex-wrap gap-2">
          <Button type="submit" variant="secondary" disabled={saving}>
            {saving ? "Speichere…" : "Name speichern"}
          </Button>
          <Link to="/report" className="inline-flex">
            <Button variant="primary" iconLeft={<FileText size={16} aria-hidden />} onClick={() => undefined}>
              Nachweis öffnen
            </Button>
          </Link>
        </div>
      </form>
      {message && (
        <Callout tone={message.tone} className="mt-3">
          {message.text}
        </Callout>
      )}
    </Card>
  );
}

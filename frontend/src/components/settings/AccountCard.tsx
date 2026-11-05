import { useState } from "react";
import { changePasswordRequest, deleteAccountRequest } from "../../api/auth.api";
import { ApiError } from "../../api/client";
import { useAuth } from "../../hooks/useAuth";
import { Button, Callout, Card, Field, Input } from "../ui";

// Password change and account deletion for the signed-in account. Each account has its own,
// fully separated data, so deleting one removes only that account's data on the server.
export function AccountCard() {
  const { user, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changeState, setChangeState] = useState<{ tone: "info" | "danger"; text: string } | null>(null);
  const [changing, setChanging] = useState(false);

  const [confirming, setConfirming] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleChange = async () => {
    setChangeState(null);
    setChanging(true);
    try {
      await changePasswordRequest({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setChangeState({ tone: "info", text: "Passwort geändert. Andere Geräte werden abgemeldet." });
    } catch (err) {
      setChangeState({
        tone: "danger",
        text: err instanceof ApiError ? err.message : "Passwort konnte nicht geändert werden.",
      });
    } finally {
      setChanging(false);
    }
  };

  const handleDelete = async () => {
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteAccountRequest({ password: deletePassword });
      await logout();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Konto konnte nicht gelöscht werden.");
      setDeleting(false);
    }
  };

  return (
    <Card title="Konto">
      <p className="mb-3 text-small text-text-subtle">Angemeldet als {user?.email}.</p>
      <div className="flex flex-col gap-3">
        <Field label="Aktuelles Passwort">
          {(p) => (
            <Input
              {...p}
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          )}
        </Field>
        <Field label="Neues Passwort" hint="Mindestens 8 Zeichen">
          {(p) => (
            <Input
              {...p}
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          )}
        </Field>
        <Button
          variant="primary"
          disabled={!currentPassword || newPassword.length < 8 || changing}
          onClick={handleChange}
        >
          {changing ? "Speichert…" : "Passwort ändern"}
        </Button>
        {changeState && <Callout tone={changeState.tone}>{changeState.text}</Callout>}

        <hr className="border-border" />

        {!confirming ? (
          <Button variant="ghost" onClick={() => setConfirming(true)}>
            Konto löschen…
          </Button>
        ) : (
          <div className="flex flex-col gap-3">
            <Callout tone="danger">
              Löscht dieses Konto mit allen Trainings, Plänen, Messwerten und Fotos auf dem Server. Das lässt sich
              nicht rückgängig machen.
            </Callout>
            <Field label="Passwort zur Bestätigung">
              {(p) => (
                <Input
                  {...p}
                  type="password"
                  autoComplete="current-password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                />
              )}
            </Field>
            <div className="flex gap-2">
              <Button variant="danger" className="flex-1" disabled={!deletePassword || deleting} onClick={handleDelete}>
                {deleting ? "Löscht…" : "Konto endgültig löschen"}
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                Abbrechen
              </Button>
            </div>
            {deleteError && <Callout tone="danger">{deleteError}</Callout>}
          </div>
        )}
      </div>
    </Card>
  );
}

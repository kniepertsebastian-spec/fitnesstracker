import { useState } from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { logoutWarnings } from "../../lib/logoutWarning";
import { useSyncStore } from "../../stores/syncStore";
import { Button, Callout, Dialog, IconButton } from "../ui";

export function UserRow() {
  const { user, logout } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const isOnline = useSyncStore((s) => s.isOnline);
  const pendingCount = useSyncStore((s) => s.pendingCount);
  const failedCount = useSyncStore((s) => s.failedCount);
  if (!user) return null;
  const name = user.displayName?.trim() || user.email;
  const warnings = logoutWarnings({ isOnline, pendingCount, failedCount });

  const confirm = async () => {
    setLeaving(true);
    await logout();
  };

  return (
    <div className="flex items-center gap-3 border-t border-border-subtle pt-3">
      <span
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-small font-semibold uppercase text-accent-text"
      >
        {name.charAt(0)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-small font-medium text-text">{name}</p>
        {user.displayName && <p className="truncate text-xs text-text-faint">{user.email}</p>}
      </div>
      <IconButton aria-label="Abmelden" onClick={() => setConfirming(true)}>
        <LogOut size={18} strokeWidth={2} aria-hidden />
      </IconButton>
      <Dialog
        open={confirming}
        onOpenChange={(open) => !leaving && setConfirming(open)}
        title="Abmelden?"
        description="Du musst dich danach erneut anmelden."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={leaving}>
              Abbrechen
            </Button>
            <Button variant="danger" onClick={confirm} disabled={leaving}>
              Abmelden
            </Button>
          </>
        }
      >
        {warnings.length > 0 && (
          <div className="space-y-2">
            {warnings.map((text) => (
              <Callout key={text} tone="warning">
                {text}
              </Callout>
            ))}
          </div>
        )}
      </Dialog>
    </div>
  );
}

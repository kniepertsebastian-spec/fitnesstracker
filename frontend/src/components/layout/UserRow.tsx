import { LogOut } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { IconButton } from "../ui";

export function UserRow() {
  const { user, logout } = useAuth();
  if (!user) return null;
  const name = user.displayName?.trim() || user.email;

  return (
    <div className="flex items-center gap-3 border-t border-border-subtle pt-3">
      <span
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-small font-semibold uppercase text-accent"
      >
        {name.charAt(0)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-small font-medium text-text">{name}</p>
        {user.displayName && <p className="truncate text-xs text-text-faint">{user.email}</p>}
      </div>
      <IconButton aria-label="Abmelden" onClick={() => logout()}>
        <LogOut size={18} strokeWidth={2} aria-hidden />
      </IconButton>
    </div>
  );
}

import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { TRAINING_PHASE_LABELS, useTrainingPlan } from "../../hooks/useTrainingPlan";
import { useSyncStore } from "../../stores/syncStore";
import { InstallButton } from "./InstallButton";
import { PRToastHost } from "./PRToastHost";
import { RestTimerWidget } from "./RestTimerWidget";
import { UpdatePrompt } from "./UpdatePrompt";

interface NavItem {
  label: string;
  to: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", to: "/" },
  { label: "Historie", to: "/history" },
  { label: "Übungen", to: "/exercises" },
  { label: "Plan", to: "/plan" },
  { label: "Fortschritt", to: "/progress" },
  { label: "Ziele", to: "/goals" },
  { label: "Ernährung", to: "/nutrition" },
  { label: "Einstellungen", to: "/settings" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { data: plan } = useTrainingPlan();
  const { isOnline, pendingCount, failedCount } = useSyncStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // Close on navigation, so picking an item never leaves a stale open menu behind.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <div className="flex min-h-screen flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <header className="flex items-center justify-between border-b border-ink-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Menü öffnen"
              aria-expanded={menuOpen}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-300 hover:bg-ink-800 hover:text-ink-100"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="h-5 w-5"
              >
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {menuOpen && (
              <div className="absolute left-0 top-full z-20 mt-2 w-48 overflow-hidden rounded-lg border border-ink-800 bg-ink-900 py-1 shadow-lg">
                {NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.label}
                    to={item.to}
                    end={item.to === "/"}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-3 py-2 text-sm ${isActive ? "text-violet-400" : "text-ink-300 hover:bg-ink-800 hover:text-ink-100"}`
                    }
                  >
                    <span>{item.label}</span>
                    {item.label === "Plan" && plan && (
                      <span className="text-xs text-ink-500">
                        {TRAINING_PHASE_LABELS[plan.currentPhase]}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            )}
          </div>

          <span className="font-semibold text-ink-100">Fitnesstracker</span>
        </div>

        <div className="flex items-center gap-3">
          <InstallButton />
          {!isOnline && (
            <span className="rounded-full bg-amber-950 px-2 py-0.5 text-xs text-amber-400">
              Offline
            </span>
          )}
          {pendingCount > 0 && (
            <span className="rounded-full bg-ink-800 px-2 py-0.5 text-xs text-ink-400">
              {pendingCount} ausstehend
            </span>
          )}
          {failedCount > 0 && (
            <span
              className="rounded-full bg-red-950 px-2 py-0.5 text-xs text-red-400"
              title="Konnte nicht synchronisiert werden — Eintrag ist lokal verloren"
            >
              {failedCount} fehlgeschlagen
            </span>
          )}
          {user && (
            <button
              onClick={() => logout()}
              className="text-sm text-ink-400 hover:text-ink-200"
            >
              Abmelden
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 py-4">{children}</main>

      <PRToastHost />
      <RestTimerWidget />
      <UpdatePrompt />
    </div>
  );
}

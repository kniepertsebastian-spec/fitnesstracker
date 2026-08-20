import type { ReactNode } from "react";
import { useAuth } from "../../hooks/useAuth";

interface NavItem {
  label: string;
  active: boolean;
}

// Only "Log" is wired up this session; the rest are placeholders for upcoming roadmap phases
// (exercise library, training plan rotation, goals) so the nav layout doesn't need rework later.
const NAV_ITEMS: NavItem[] = [
  { label: "Log", active: true },
  { label: "Übungen", active: false },
  { label: "Plan", active: false },
  { label: "Ziele", active: false },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <span className="font-semibold text-slate-100">Fitnesstracker</span>
        {user && (
          <button
            onClick={() => logout()}
            className="text-sm text-slate-400 hover:text-slate-200"
          >
            Abmelden
          </button>
        )}
      </header>

      <main className="flex-1 px-4 py-4">{children}</main>

      <nav className="flex border-t border-slate-800">
        {NAV_ITEMS.map((item) => (
          <div
            key={item.label}
            className={`flex-1 py-3 text-center text-sm ${
              item.active ? "text-sky-400" : "cursor-not-allowed text-slate-600"
            }`}
          >
            {item.label}
          </div>
        ))}
      </nav>
    </div>
  );
}

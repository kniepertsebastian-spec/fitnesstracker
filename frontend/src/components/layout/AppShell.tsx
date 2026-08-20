import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { TRAINING_PHASE_LABELS, useTrainingPlan } from "../../hooks/useTrainingPlan";
import { useSyncStore } from "../../stores/syncStore";

interface NavItem {
  label: string;
  to: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Log", to: "/" },
  { label: "Übungen", to: "/exercises" },
  { label: "Plan", to: "/plan" },
  { label: "Ziele", to: "/goals" },
  { label: "Ernährung", to: "/nutrition" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { data: plan } = useTrainingPlan();
  const { isOnline, pendingCount } = useSyncStore();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <span className="font-semibold text-slate-100">Fitnesstracker</span>
        <div className="flex items-center gap-3">
          {!isOnline && (
            <span className="rounded-full bg-amber-950 px-2 py-0.5 text-xs text-amber-400">
              Offline
            </span>
          )}
          {pendingCount > 0 && (
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
              {pendingCount} ausstehend
            </span>
          )}
          {user && (
            <button
              onClick={() => logout()}
              className="text-sm text-slate-400 hover:text-slate-200"
            >
              Abmelden
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 py-4">{children}</main>

      <nav className="flex border-t border-slate-800">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center py-3 text-center text-xs ${isActive ? "text-violet-400" : "text-slate-500 hover:text-slate-300"}`
            }
          >
            <span>{item.label}</span>
            {item.label === "Plan" && plan && (
              <span className="text-[10px] leading-tight text-slate-500">
                {TRAINING_PHASE_LABELS[plan.currentPhase]}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

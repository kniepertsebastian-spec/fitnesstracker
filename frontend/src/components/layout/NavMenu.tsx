import { NavLink, useLocation } from "react-router-dom";
import { TRAINING_PHASE_LABELS, useTrainingPlan } from "../../hooks/useTrainingPlan";
import { phaseWeek } from "../../lib/phase";
import { Badge, cn } from "../ui";

export const NAV_ITEMS = [
  { label: "Dashboard", to: "/" },
  { label: "Daily", to: "/daily" },
  { label: "Fitnesstagebuch", to: "/diary" },
  { label: "Übungen", to: "/exercises" },
  { label: "Plan", to: "/plan" },
  { label: "Fortschritt", to: "/progress" },
  { label: "Ziele", to: "/goals" },
  { label: "Ernährung", to: "/nutrition" },
  { label: "Einstellungen", to: "/settings" },
] as const;

// The nine entries in their fixed order; "Plan" carries the current phase as a badge. Shared by
// the mobile menu sheet and the desktop sidebar.
export function NavMenu({ className }: { className?: string }) {
  const { data: plan } = useTrainingPlan();
  const { pathname } = useLocation();
  // The history page is the second tab of the "Fitnesstagebuch" entry.
  const active = (to: string, routeActive: boolean) =>
    routeActive || (to === "/diary" && pathname === "/history");

  return (
    <nav aria-label="Hauptmenü" className={cn("flex flex-col gap-0.5", className)}>
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.label}
          to={item.to}
          end={item.to === "/"}
          className={({ isActive: routeActive }) => {
            const isActive = active(item.to, routeActive);
            return cn(
              "flex min-h-[46px] items-center gap-3 rounded-sm px-3 text-body font-medium transition-colors duration-150",
              isActive ? "bg-surface-2 text-text" : "text-text-muted hover:bg-surface-2 hover:text-text",
            );
          }}
        >
          {({ isActive: routeActive }) => {
            const isActive = active(item.to, routeActive);
            return (
              <>
                <span
                  aria-hidden
                  className={cn(
                    "-ml-1 h-5 w-[3px] shrink-0 rounded-full",
                    isActive ? "bg-accent" : "bg-transparent",
                  )}
                />
                <span className="flex-1">{item.label}</span>
                {item.label === "Plan" && plan && (
                  <Badge tone="accent">
                    {TRAINING_PHASE_LABELS[plan.currentPhase]} · W{phaseWeek(plan)}
                  </Badge>
                )}
              </>
            );
          }}
        </NavLink>
      ))}
    </nav>
  );
}

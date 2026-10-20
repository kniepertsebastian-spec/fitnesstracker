import { NavLink } from "react-router-dom";
import { cn } from "../ui";

const TABS = [
  { label: "Heute", to: "/diary" },
  { label: "Verlauf", to: "/history" },
] as const;

// Fitnesstagebuch and Historie are one menu entry; this switches between the two pages.
export function DiaryTabs() {
  return (
    <nav
      aria-label="Tagebuch"
      className="mb-4 inline-flex rounded-md border border-border-strong bg-surface-inset p-0.5"
    >
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            cn(
              "flex min-h-[40px] items-center rounded-sm px-4 text-small font-medium transition-colors duration-150",
              isActive ? "bg-surface-2 text-text" : "text-text-muted hover:text-text",
            )
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}

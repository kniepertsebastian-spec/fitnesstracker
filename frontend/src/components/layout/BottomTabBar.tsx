import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { CalendarDays, Dumbbell, LineChart, Menu, Sun } from "lucide-react";
import { useOpenWorkoutSession, useStartWorkoutSession } from "../../hooks/useWorkoutSession";
import { cn } from "../ui";

const ITEM =
  "relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-overline font-medium transition-colors duration-150";

// The active tab carries a short violet bar on the bar's top edge, in addition to its color.
function linkClass({ isActive }: { isActive: boolean }) {
  return cn(
    ITEM,
    isActive
      ? "text-accent before:absolute before:inset-x-5 before:top-0 before:h-0.5 before:rounded-full before:bg-accent"
      : "text-text-muted hover:text-text",
  );
}

function Tab({ to, label, icon, end }: { to: string; label: string; icon: ReactNode; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className={linkClass}>
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}

// Mobile-only (< 1024 px) thumb-reach navigation: Heute · Training · Fortschritt · Plan · Mehr.
// "Mehr" opens the full menu sheet; "Training" starts or resumes a session like StartTrainingButton.
export function BottomTabBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const navigate = useNavigate();
  const { data: session } = useOpenWorkoutSession();
  const start = useStartWorkoutSession();

  const openTraining = () => {
    if (session) {
      navigate("/training");
      return;
    }
    start.mutate(crypto.randomUUID(), {
      onSuccess: () => navigate("/training"),
    });
  };

  return (
    <nav
      aria-label="Schnellzugriff"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-bg-sidebar/95 pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <Tab to="/" end label="Heute" icon={<Sun size={20} aria-hidden />} />
      <button
        type="button"
        className={cn(ITEM, "text-text-muted hover:text-text")}
        disabled={start.isPending}
        onClick={openTraining}
      >
        <span
          aria-hidden
          className="light-edge -mt-0.5 flex h-9 w-12 items-center justify-center rounded-full bg-accent bg-accent-fill text-on-accent"
        >
          <Dumbbell size={19} />
        </span>
        <span className="text-text">Training</span>
      </button>
      <Tab to="/progress" label="Fortschritt" icon={<LineChart size={20} aria-hidden />} />
      <Tab to="/plan" label="Plan" icon={<CalendarDays size={20} aria-hidden />} />
      <button type="button" className={cn(ITEM, "text-text-muted hover:text-text")} onClick={onOpenMenu}>
        <Menu size={20} aria-hidden />
        <span>Mehr</span>
      </button>
    </nav>
  );
}

import { Dumbbell } from "lucide-react";
import { cn } from "../ui";

// `compactBelowSm`: the mobile top bar drops the wordmark on very narrow viewports (large system
// font/display size), so the sync pill and menu button keep their room.
export function Logo({ compactBelowSm = false }: { compactBelowSm?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span
        aria-hidden
        className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-sm bg-accent text-on-accent"
      >
        <Dumbbell size={17} strokeWidth={2.2} />
      </span>
      <span className={cn("truncate text-h2 text-text", compactBelowSm && "max-[379px]:sr-only")}>Fitnesstracker</span>
    </div>
  );
}

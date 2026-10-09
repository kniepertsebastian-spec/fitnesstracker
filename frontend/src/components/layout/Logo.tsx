import { Dumbbell } from "lucide-react";

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="flex h-[30px] w-[30px] items-center justify-center rounded-sm bg-accent text-on-accent"
      >
        <Dumbbell size={17} strokeWidth={2.2} />
      </span>
      <span className="text-h2 text-text">Fitnesstracker</span>
    </div>
  );
}

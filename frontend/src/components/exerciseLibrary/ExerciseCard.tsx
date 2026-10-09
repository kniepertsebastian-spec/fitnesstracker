import { Link } from "react-router-dom";
import type { ExerciseDto } from "@fitnesstracker/shared";
import { Badge } from "../ui";

export function ExerciseCard({ exercise }: { exercise: ExerciseDto }) {
  const thumbnail = exercise.imageUrls[0];

  return (
    <Link
      to={`/exercises/${exercise.id}`}
      className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 transition-colors duration-150 hover:bg-surface-2"
    >
      {thumbnail ? (
        <img src={thumbnail} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-lg bg-track object-cover" />
      ) : (
        <div className="h-14 w-14 shrink-0 rounded-lg bg-track" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-body font-medium text-text">
          <span className="truncate">{exercise.name}</span>
          {!exercise.isActive && <Badge>Inaktiv</Badge>}
        </p>
        <p className="truncate text-small text-text-faint">
          {[exercise.equipment, exercise.primaryMuscles.join(", ")].filter(Boolean).join(" · ") || "—"}
        </p>
      </div>
    </Link>
  );
}

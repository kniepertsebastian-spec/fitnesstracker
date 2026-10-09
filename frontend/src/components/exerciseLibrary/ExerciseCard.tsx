import { Link } from "react-router-dom";
import type { ExerciseDto } from "@fitnesstracker/shared";

export function ExerciseCard({ exercise }: { exercise: ExerciseDto }) {
  const thumbnail = exercise.imageUrls[0];

  return (
    <Link
      to={`/exercises/${exercise.id}`}
      className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 hover:border-border-strong"
    >
      {thumbnail ? (
        <img src={thumbnail} alt="" className="h-12 w-12 rounded-md object-cover" />
      ) : (
        <div className="h-12 w-12 shrink-0 rounded-md bg-surface-2" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-text">
          {exercise.name}
          {!exercise.isActive && (
            <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-normal text-text-faint">
              Inaktiv
            </span>
          )}
        </p>
        <p className="truncate text-sm text-text-faint">
          {[exercise.equipment, exercise.primaryMuscles.join(", ")].filter(Boolean).join(" · ") ||
            "—"}
        </p>
      </div>
    </Link>
  );
}

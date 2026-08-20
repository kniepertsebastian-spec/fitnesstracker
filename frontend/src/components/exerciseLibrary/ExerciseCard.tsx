import { Link } from "react-router-dom";
import type { ExerciseDto } from "@fitnesstracker/shared";

export function ExerciseCard({ exercise }: { exercise: ExerciseDto }) {
  const thumbnail = exercise.imageUrls[0];

  return (
    <Link
      to={`/exercises/${exercise.id}`}
      className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 p-3 hover:border-slate-700"
    >
      {thumbnail ? (
        <img src={thumbnail} alt="" className="h-12 w-12 rounded-md object-cover" />
      ) : (
        <div className="h-12 w-12 shrink-0 rounded-md bg-slate-800" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-slate-100">{exercise.name}</p>
        <p className="truncate text-sm text-slate-500">
          {[exercise.equipment, exercise.primaryMuscles.join(", ")].filter(Boolean).join(" · ") ||
            "—"}
        </p>
      </div>
    </Link>
  );
}

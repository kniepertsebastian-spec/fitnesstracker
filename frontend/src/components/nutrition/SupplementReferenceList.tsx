import { SUPPLEMENT_REFERENCE, type SupplementRating } from "../../data/supplementReference";

const RATING_LABELS: Record<SupplementRating, string> = {
  effective: "Wirklich wirksam",
  situational: "Situativ",
  overrated: "Überschätzt",
};

const RATING_STYLES: Record<SupplementRating, string> = {
  effective: "bg-emerald-950 text-emerald-400",
  situational: "bg-amber-950 text-amber-400",
  overrated: "bg-slate-800 text-slate-400",
};

export function SupplementReferenceList() {
  return (
    <div>
      <h2 className="mb-2 text-sm font-medium text-slate-400">Supplement-Referenz</h2>
      <div className="flex flex-col gap-2">
        {SUPPLEMENT_REFERENCE.map((entry) => (
          <div key={entry.name} className="rounded-lg border border-slate-800 bg-slate-900 p-3">
            <div className="mb-1 flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-slate-200">{entry.name}</p>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${RATING_STYLES[entry.rating]}`}
              >
                {RATING_LABELS[entry.rating]}
              </span>
            </div>
            <p className="text-sm text-slate-400">{entry.description}</p>
            {entry.dosage !== "—" && (
              <p className="mt-1 text-xs text-slate-600">Übliche Dosierung: {entry.dosage}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

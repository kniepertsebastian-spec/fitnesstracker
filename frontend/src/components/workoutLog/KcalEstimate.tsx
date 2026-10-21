import { Link } from "react-router-dom";
import { useBurnProfile } from "../../hooks/useBurnProfile";
import { formatKcal, setsKcal } from "../../lib/calories";

// "≈ N kcal" for the given sets, or — when no profile exists yet — a nudge to fill it in.
export function KcalEstimate({ sets, withHint = false }: { sets: { weightKg: number; reps: number }[]; withHint?: boolean }) {
  const profile = useBurnProfile();
  if (!profile) {
    return withHint ? (
      <Link to="/nutrition" className="text-small text-accent hover:text-accent-hover">
        Profil ausfüllen für die kcal-Schätzung
      </Link>
    ) : null;
  }
  if (sets.length === 0) return null;
  return (
    <span className="tabular text-small text-text-subtle" title="Geschätzter Energieverbrauch der Sätze (ohne Satzpausen)">
      {formatKcal(setsKcal(profile, sets))}
    </span>
  );
}

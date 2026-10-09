import type { DailyChallengeCategory, DailyChallengeItemDto } from "@fitnesstracker/shared";
import type { LocalWorkoutLog } from "../offline/db";
import type { BadgeTone } from "../components/ui";

export const CHALLENGE_CATEGORIES: Record<DailyChallengeCategory, { label: string; tone: BadgeTone }> = {
  PROGRESSION: { label: "Progression", tone: "accent" },
  VOLUME: { label: "Volumen", tone: "info" },
  CONSISTENCY: { label: "Konsistenz", tone: "warning" },
  TECHNIQUE: { label: "Technik", tone: "violet" },
  RECOVERY: { label: "Erholung", tone: "neutral" },
};

// Short "why this number" line under the target — derived from the item's category and the
// locally cached history (best reps ever logged for the exercise), same rules as the backend's
// target calculation (dailyChallenge.service.ts).
export function challengeReason(item: DailyChallengeItemDto, logs: LocalWorkoutLog[]): string {
  const bestReps = Math.max(0, ...logs.filter((l) => l.exerciseId === item.exerciseId).map((l) => l.reps));
  switch (item.category) {
    case "PROGRESSION":
      return bestReps > 0 && item.targetReps > bestReps
        ? `${item.targetReps - bestReps} über deinem Bestwert`
        : "neuer Bestwert";
    case "VOLUME":
      return "mehr Umfang als gewohnt";
    case "CONSISTENCY":
      return "gewohntes Pensum, einfach dranbleiben";
    case "TECHNIQUE":
      return "saubere Wiederholungen statt Menge";
    case "RECOVERY":
      return "leichte Bewegung zur Erholung";
  }
}

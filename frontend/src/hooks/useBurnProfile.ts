import type { BodyProfile } from "../lib/calories";
import { useBodyCompositionEntries } from "./useBodyComposition";
import { useProfile } from "./useProfile";

// What the calorie estimate needs: height, age and sex from the profile (Ernährung → Profil) and
// the most recent weight — the latest body measurement if there is one, else the profile's weight.
// Null until a profile exists.
export function useBurnProfile(): BodyProfile | null {
  const { data: profile } = useProfile();
  const { data: entries } = useBodyCompositionEntries();
  if (!profile) return null;
  const latest = [...(entries ?? [])].sort((a, b) => (a.measuredAt < b.measuredAt ? 1 : -1))[0];
  return {
    weightKg: latest?.weightKg ?? profile.weightKg,
    heightCm: profile.heightCm,
    age: profile.age,
    gender: profile.gender,
  };
}

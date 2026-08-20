import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ActivityLevel, Gender, NutritionGoal, UpsertProfileInput } from "@fitnesstracker/shared";
import { getProfileRequest, upsertProfileRequest } from "../api/profile.api";

const PROFILE_KEY = ["profile"];

export const GENDER_LABELS: Record<Gender, string> = {
  MALE: "Männlich",
  FEMALE: "Weiblich",
};

export const ACTIVITY_LEVEL_LABELS: Record<ActivityLevel, string> = {
  SEDENTARY: "Kaum Bewegung",
  LIGHT: "Leicht aktiv (1-3x/Woche)",
  MODERATE: "Mäßig aktiv (3-5x/Woche)",
  ACTIVE: "Sehr aktiv (6-7x/Woche)",
  VERY_ACTIVE: "Extrem aktiv + körperliche Arbeit",
};

export const NUTRITION_GOAL_LABELS: Record<NutritionGoal, string> = {
  CUT: "Abnehmen",
  MAINTAIN: "Halten",
  BULK: "Aufbauen",
};

export function useProfile() {
  return useQuery({
    queryKey: PROFILE_KEY,
    queryFn: getProfileRequest,
  });
}

export function useUpsertProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertProfileInput) => upsertProfileRequest(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROFILE_KEY }),
  });
}

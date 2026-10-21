import type { WeeklyMuscleVolumeDto } from "@fitnesstracker/shared";
import { apiFetch } from "./client";

export function weeklyMuscleVolumeRequest(weeks: number) {
  return apiFetch<WeeklyMuscleVolumeDto>(`/workout-logs/muscle-volume?weeks=${weeks}`);
}

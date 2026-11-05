import { useQuery } from "@tanstack/react-query";
import { weeklyMuscleVolumeRequest } from "../api/muscleVolume.api";

export function useWeeklyMuscleVolume(weeks: number) {
  return useQuery({ queryKey: ["muscle-volume", weeks], queryFn: () => weeklyMuscleVolumeRequest(weeks) });
}

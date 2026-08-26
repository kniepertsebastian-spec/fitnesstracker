import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SaveAiSettingsInput } from "@fitnesstracker/shared";
import {
  deleteAiSettingsRequest,
  getAiSettingsRequest,
  saveAiSettingsRequest,
} from "../api/aiSettings.api";

const AI_SETTINGS_KEY = ["ai-settings"];

export function useAiSettings() {
  return useQuery({ queryKey: AI_SETTINGS_KEY, queryFn: getAiSettingsRequest });
}

export function useSaveAiSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveAiSettingsInput) => saveAiSettingsRequest(input),
    onSuccess: (data) => queryClient.setQueryData(AI_SETTINGS_KEY, data),
  });
}

export function useDeleteAiSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => deleteAiSettingsRequest(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AI_SETTINGS_KEY }),
  });
}

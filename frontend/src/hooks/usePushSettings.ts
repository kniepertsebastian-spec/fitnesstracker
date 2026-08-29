import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UpdatePushSettingsInput } from "@fitnesstracker/shared";
import { getPushSettingsRequest, updatePushSettingsRequest } from "../api/push.api";

const PUSH_SETTINGS_KEY = ["push-settings"];

export function usePushSettings() {
  return useQuery({
    queryKey: PUSH_SETTINGS_KEY,
    queryFn: getPushSettingsRequest,
  });
}

export function useUpdatePushSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePushSettingsInput) => updatePushSettingsRequest(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PUSH_SETTINGS_KEY }),
  });
}

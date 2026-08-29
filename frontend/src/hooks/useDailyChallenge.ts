import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DailyChallengeItemDto } from "@fitnesstracker/shared";
import {
  addChallengeRepsRequest,
  getDailyChallengeRequest,
  rerollChallengeItemRequest,
} from "../api/dailyChallenge.api";

const DAILY_CHALLENGE_KEY = ["daily-challenge"];

export function useDailyChallenge() {
  return useQuery({
    queryKey: DAILY_CHALLENGE_KEY,
    queryFn: () => getDailyChallengeRequest().then((r) => r.items),
  });
}

export function useAddChallengeReps() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, delta }: { itemId: string; delta: number }) =>
      addChallengeRepsRequest(itemId, delta),
    onSuccess: (updated) => {
      queryClient.setQueryData<DailyChallengeItemDto[]>(DAILY_CHALLENGE_KEY, (items) =>
        items?.map((item) => (item.id === updated.id ? updated : item)),
      );
    },
  });
}

export function useRerollChallengeItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => rerollChallengeItemRequest(itemId),
    onSuccess: (updated) => {
      queryClient.setQueryData<DailyChallengeItemDto[]>(DAILY_CHALLENGE_KEY, (items) =>
        items?.map((item) => (item.id === updated.id ? updated : item)),
      );
    },
  });
}

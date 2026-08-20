import { QueryClient } from "@tanstack/react-query";

// A module-level singleton (rather than one created inside main.tsx) so code outside the React
// tree — the offline sync manager's online-event handler in particular — can push fresh data
// into the cache too, not just components via useQueryClient().
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { Skeleton } from "../ui";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, status } = useAuth();

  if (status === "idle" || status === "loading") {
    // App-shell skeleton (top bar, content, bottom tab bar) instead of a bare "Lädt…" on a cold start.
    return (
      <div role="status" aria-label="Lädt…" className="min-h-screen bg-bg text-text lg:grid lg:grid-cols-[248px_1fr]">
        <aside className="hidden h-screen flex-col gap-3 border-r border-border bg-bg-sidebar p-4 lg:flex">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-12 w-full" />
          {Array.from({ length: 9 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </aside>
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center justify-between border-b border-border bg-bg-sidebar px-4 py-3 lg:border-b-0 lg:bg-transparent">
            <Skeleton className="h-6 w-28 lg:hidden" />
            <Skeleton className="ml-auto h-8 w-24" />
          </div>
          <div className="flex flex-col gap-4 px-4 py-4 lg:px-10 lg:py-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
        <div className="fixed inset-x-0 bottom-0 h-14 border-t border-border bg-bg-sidebar lg:hidden" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

import { Trash2 } from "lucide-react";
import { useUndoStore } from "../../stores/undoStore";
import { Button, Toast } from "../ui";

// Mounted once in AppShell, like PRToastHost: the "Rückgängig" toast for a delete that is still
// inside its undo window (see stores/undoStore.ts).
export function UndoToastHost() {
  const toasts = useUndoStore((s) => s.toasts);
  const undo = useUndoStore((s) => s.undo);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed left-0 right-0 top-[calc(0.75rem+env(safe-area-inset-top))] z-60 flex flex-col items-center gap-2 px-4">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          tone="info"
          icon={<Trash2 size={20} strokeWidth={1.8} />}
          className="pointer-events-auto w-full max-w-sm"
        >
          <span className="flex items-center justify-between gap-3">
            <span className="min-w-0">{toast.message}</span>
            <Button variant="secondary" size="sm" onClick={() => undo(toast.id)}>
              Rückgängig
            </Button>
          </span>
        </Toast>
      ))}
    </div>
  );
}

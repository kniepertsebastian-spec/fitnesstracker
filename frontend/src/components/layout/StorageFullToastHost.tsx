import { HardDrive } from "lucide-react";
import { useStorageNoticeStore } from "../../stores/storageNoticeStore";
import { Button, Toast } from "../ui";

// Mounted once for signed-in users (AuthenticatedRuntime), so it also shows over the focus mode,
// which has no AppShell. Top of the screen like the record and undo toasts; it doesn't block the
// page and stays until closed.
export function StorageFullToastHost() {
  const message = useStorageNoticeStore((s) => s.message);
  const dismiss = useStorageNoticeStore((s) => s.dismiss);

  if (!message) return null;

  return (
    <div className="pointer-events-none fixed left-[env(safe-area-inset-left)] right-[env(safe-area-inset-right)] top-[calc(0.75rem+env(safe-area-inset-top))] z-60 flex flex-col items-center px-4">
      <Toast
        tone="danger"
        icon={<HardDrive size={20} strokeWidth={1.8} />}
        overline="Speicher voll"
        className="pointer-events-auto w-full max-w-sm"
      >
        <span className="block text-small font-normal text-text-muted">{message}</span>
        <span className="mt-2 flex justify-end">
          <Button variant="secondary" size="sm" onClick={dismiss}>
            OK
          </Button>
        </span>
      </Toast>
    </div>
  );
}

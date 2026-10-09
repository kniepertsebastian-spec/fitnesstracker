import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { IconButton, Sheet, SheetClose } from "../ui";
import { InstallButton } from "./InstallButton";
import { Logo } from "./Logo";
import { NavMenu } from "./NavMenu";
import { PRToastHost } from "./PRToastHost";
import { RestTimerWidget } from "./RestTimerWidget";
import { StartTrainingButton } from "./StartTrainingButton";
import { SyncStatusIndicator } from "./SyncStatusIndicator";
import { UserRow } from "./UserRow";

// Mobile (< 1024 px): top bar + right-hand menu sheet. Desktop: fixed 248 px sidebar with the
// same ten entries. Safe-area insets stay on the outer frame.
export function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // Close on navigation, so picking an item never leaves a stale open menu behind.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-bg pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-text lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col gap-4 border-r border-border bg-bg-sidebar p-4 lg:flex">
        <Logo />
        <StartTrainingButton size="lg" fullWidth />
        <div className="-mx-1 flex-1 overflow-y-auto px-1">
          <NavMenu />
        </div>
        <InstallButton />
        <UserRow />
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border bg-bg-sidebar px-4 py-2 lg:justify-end lg:border-b-0 lg:bg-transparent lg:px-10 lg:pt-5">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="flex items-center gap-2">
            <SyncStatusIndicator />
            <IconButton
              aria-label="Menü öffnen"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
              className="lg:hidden"
            >
              <Menu size={20} strokeWidth={2} aria-hidden />
            </IconButton>
          </div>
        </header>

        <main className="flex-1 px-4 py-4 lg:px-10 lg:py-6">{children}</main>
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen} title="Menü" className="gap-4 p-4">
        <div className="flex items-center justify-between">
          <Logo />
          <SheetClose asChild>
            <IconButton aria-label="Menü schließen">
              <X size={20} strokeWidth={2} aria-hidden />
            </IconButton>
          </SheetClose>
        </div>
        <StartTrainingButton size="lg" fullWidth onNavigate={() => setMenuOpen(false)} />
        <div className="flex-1 overflow-y-auto">
          <NavMenu />
        </div>
        <InstallButton />
        <UserRow />
      </Sheet>

      <PRToastHost />
      <RestTimerWidget />
    </div>
  );
}

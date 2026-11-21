import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useSyncTimeZone } from "../../hooks/useSyncTimeZone";
import { IconButton, Sheet, SheetClose } from "../ui";
import { BottomTabBar } from "./BottomTabBar";
import { InstallButton } from "./InstallButton";
import { LightBand } from "./LightBand";
import { Logo } from "./Logo";
import { NavMenu } from "./NavMenu";
import { PRToastHost } from "./PRToastHost";
import { UndoToastHost } from "./UndoToastHost";
import { RestTimerWidget } from "./RestTimerWidget";
import { StartTrainingButton } from "./StartTrainingButton";
import { SyncStatusIndicator } from "./SyncStatusIndicator";
import { UserRow } from "./UserRow";

const MAIN_ID = "main-content";

// Mobile (< 1024 px): top bar, bottom tab bar and a right-hand menu sheet ("Mehr"). Desktop: fixed
// 248 px sidebar with the same nine entries. Safe-area insets stay on the outer frame.
export function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  useSyncTimeZone();

  // Close on navigation, so picking an item never leaves a stale open menu behind.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Focus moves to <main> directly instead of following the hash: a `#main-content` in the URL
  // would linger after every later navigation, and the router would treat it as a history entry.
  const skipToContent = (event: MouseEvent<HTMLAnchorElement>) => {
    const main = document.getElementById(MAIN_ID);
    if (!main) return;
    event.preventDefault();
    main.focus();
    main.scrollIntoView({ block: "start" });
  };

  return (
    // Left/right insets: an iPhone in landscape puts the notch / Dynamic Island on one side.
    <div className="min-h-screen bg-bg pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)] text-text lg:grid lg:grid-cols-[248px_1fr] lg:pb-[env(safe-area-inset-bottom)]">
      <a
        href={`#${MAIN_ID}`}
        onClick={skipToContent}
        // `focus:` on the padding too: `not-sr-only` resets padding to 0 and would win otherwise.
        className="sr-only rounded-md bg-accent text-body font-semibold text-on-accent shadow-overlay focus:not-sr-only focus:fixed focus:px-4 focus:py-3 focus:left-[calc(1rem+env(safe-area-inset-left))] focus:top-[calc(0.5rem+env(safe-area-inset-top))] focus:z-50"
      >
        Zum Inhalt springen
      </a>
      <LightBand />
      <aside className="sticky top-0 z-10 hidden h-screen flex-col gap-4 border-r border-border bg-bg-sidebar p-4 lg:flex">
        <Logo />
        <StartTrainingButton size="lg" fullWidth />
        <div className="-mx-1 flex-1 overflow-y-auto px-1">
          <NavMenu />
        </div>
        <InstallButton />
        <UserRow />
      </aside>

      <div className="relative z-10 flex min-w-0 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border bg-bg-sidebar/80 px-4 py-2 lg:justify-end lg:border-b-0 lg:bg-transparent lg:px-10 lg:pt-5">
          <div className="min-w-0 lg:hidden">
            <Logo compactBelowSm />
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <SyncStatusIndicator />
            <IconButton
              aria-label="Menü öffnen"
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
              className="lg:hidden"
            >
              <Menu size={20} strokeWidth={2} aria-hidden />
            </IconButton>
          </div>
        </header>

        {/* tabIndex -1: focusable by the skip link only, never a Tab stop. Inline outline style
            because the global :focus-visible rule (styles/index.css) sits outside Tailwind's
            layers and would draw a frame around the whole page after a keyboard skip. */}
        <main
          id={MAIN_ID}
          tabIndex={-1}
          style={{ outline: "none" }}
          className="flex-1 px-4 pb-[calc(9rem+env(safe-area-inset-bottom))] pt-4 lg:px-10 lg:pb-6 lg:pt-6"
        >
          {children}
        </main>
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

      <BottomTabBar menuOpen={menuOpen} onOpenMenu={() => setMenuOpen(true)} />
      <PRToastHost />
      <UndoToastHost />
      <RestTimerWidget />
    </div>
  );
}

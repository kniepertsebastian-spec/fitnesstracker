import { useId, useState } from "react";
import { Download } from "lucide-react";
import { useInstallPrompt } from "../../hooks/useInstallPrompt";
import type { IOSBrowser } from "../../lib/iosPlatform";
import { Button, Callout } from "../ui";

function IOSInstallHint({ browser }: { browser: IOSBrowser }) {
  const addToHome = <span className="font-medium text-text">„Zum Home-Bildschirm“</span>;
  if (browser.kind === "safari") {
    return (
      <>
        Tippe unten in Safari auf <span className="font-medium text-text">Teilen</span> und dann auf {addToHome}, um
        die App zu installieren.
      </>
    );
  }
  return (
    <>
      Öffne in {browser.name} oben rechts das <span className="font-medium text-text">Teilen</span>-Menü und wähle{" "}
      {addToHome}. Klappt das nicht, öffne die Seite in Safari und installiere sie dort.
    </>
  );
}

export function InstallButton() {
  const { installed, canPromptInstall, iosBrowser, promptInstall } = useInstallPrompt();
  const [showIOSHint, setShowIOSHint] = useState(false);
  const hintId = useId();

  if (installed || (!canPromptInstall && !iosBrowser)) return null;

  const showsHint = !canPromptInstall && iosBrowser !== null;

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="ghost"
        size="sm"
        iconLeft={<Download size={16} strokeWidth={2} aria-hidden />}
        aria-expanded={showsHint ? showIOSHint : undefined}
        aria-controls={showsHint && showIOSHint ? hintId : undefined}
        onClick={() => (canPromptInstall ? promptInstall() : setShowIOSHint((v) => !v))}
      >
        Installieren
      </Button>
      {showsHint && showIOSHint && (
        <div id={hintId}>
          <Callout tone="info">
            <IOSInstallHint browser={iosBrowser} />
          </Callout>
        </div>
      )}
    </div>
  );
}

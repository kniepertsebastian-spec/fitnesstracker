import { useState } from "react";
import { Download } from "lucide-react";
import { useInstallPrompt } from "../../hooks/useInstallPrompt";
import { Button, Callout } from "../ui";

export function InstallButton() {
  const { installed, canPromptInstall, isIOS, promptInstall } = useInstallPrompt();
  const [showIOSHint, setShowIOSHint] = useState(false);

  if (installed || (!canPromptInstall && !isIOS)) return null;

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="ghost"
        size="sm"
        iconLeft={<Download size={16} strokeWidth={2} aria-hidden />}
        onClick={() => (canPromptInstall ? promptInstall() : setShowIOSHint((v) => !v))}
      >
        Installieren
      </Button>
      {showIOSHint && (
        <Callout tone="info">
          Tippe unten in Safari auf <span className="font-medium text-text">Teilen</span> und dann auf{" "}
          <span className="font-medium text-text">„Zum Home-Bildschirm“</span>, um die App zu installieren.
        </Callout>
      )}
    </div>
  );
}

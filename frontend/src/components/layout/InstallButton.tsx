import { useEffect, useRef, useState } from "react";
import { useInstallPrompt } from "../../hooks/useInstallPrompt";

export function InstallButton() {
  const { installed, canPromptInstall, isIOS, promptInstall } = useInstallPrompt();
  const [showIOSHint, setShowIOSHint] = useState(false);
  const hintRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showIOSHint) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (hintRef.current && !hintRef.current.contains(event.target as Node)) {
        setShowIOSHint(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showIOSHint]);

  if (installed || (!canPromptInstall && !isIOS)) return null;

  return (
    <div ref={hintRef} className="relative">
      <button
        onClick={() => (canPromptInstall ? promptInstall() : setShowIOSHint((v) => !v))}
        className="flex items-center gap-1 rounded-full border border-violet-800 px-2.5 py-1 text-xs font-medium text-violet-400 hover:bg-violet-950"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5"
        >
          <path d="M12 3v12m0 0-4-4m4 4 4-4M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
        </svg>
        Installieren
      </button>

      {showIOSHint && (
        <div className="absolute right-0 top-full z-20 mt-2 w-64 rounded-lg border border-ink-800 bg-ink-900 p-3 text-xs text-ink-300 shadow-lg">
          Tippe unten in Safari auf{" "}
          <span className="font-medium text-ink-100">Teilen</span> und dann auf{" "}
          <span className="font-medium text-ink-100">„Zum Home-Bildschirm"</span>, um die
          App zu installieren.
        </div>
      )}
    </div>
  );
}

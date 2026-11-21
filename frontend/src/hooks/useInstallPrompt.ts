import { useCallback, useEffect, useState } from "react";
import { detectIOSBrowser, isRunningStandalone } from "../lib/iosPlatform";

// Not a standard DOM type — Chromium-only event, no official TS lib definition.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isRunningStandalone());
  // iOS has no install prompt event at all: Safari and the third-party browsers each get their
  // own manual hint (InstallButton), since their share menus sit in different places.
  const [iosBrowser] = useState(() => detectIOSBrowser(window.navigator));

  useEffect(() => {
    if (installed) return;

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [installed]);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  return {
    installed,
    canPromptInstall: deferredPrompt !== null,
    isIOS: iosBrowser !== null,
    iosBrowser,
    promptInstall,
  };
}

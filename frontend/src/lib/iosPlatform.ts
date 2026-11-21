// iOS detection for the install hint (hooks/useInstallPrompt.ts) and the push status
// (hooks/usePushSubscription.ts). Pure functions over a navigator-like object so they can be unit
// tested without a browser.

export interface NavigatorLike {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
}

export type IOSBrowser =
  | { kind: "safari" }
  // Chrome, Firefox and Edge on iOS: WebKit underneath, but each with its own share menu in a
  // different place than Safari's bottom toolbar.
  | { kind: "third-party"; name: "Chrome" | "Firefox" | "Edge" };

/** Launched as an installed app (home screen / app window) rather than in a browser tab. */
export function isRunningStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari has no display-mode media query support; this is its own legacy flag.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function isIOSDevice({ userAgent, platform, maxTouchPoints = 0 }: NavigatorLike): boolean {
  // iPadOS 13+ reports as "MacIntel" with touch support, not "iPad" in the UA string.
  return /iPad|iPhone|iPod/.test(userAgent) || (platform === "MacIntel" && maxTouchPoints > 1);
}

/** `null` off iOS. On iPadOS the third-party browsers ask for desktop sites by default and are
 *  then indistinguishable from Safari — those count as Safari, which is the safer hint. */
export function detectIOSBrowser(nav: NavigatorLike): IOSBrowser | null {
  if (!isIOSDevice(nav)) return null;
  if (/CriOS/.test(nav.userAgent)) return { kind: "third-party", name: "Chrome" };
  if (/FxiOS/.test(nav.userAgent)) return { kind: "third-party", name: "Firefox" };
  if (/EdgiOS/.test(nav.userAgent)) return { kind: "third-party", name: "Edge" };
  return { kind: "safari" };
}

/** What push can do on this device. iOS (16.4+) offers Web Push only to an app opened from the
 *  home screen; in a browser tab `PushManager` is missing there, which is not the same as a device
 *  that can never receive push. */
export function pushAvailability({
  pushSupported,
  isIOS,
  standalone,
}: {
  pushSupported: boolean;
  isIOS: boolean;
  standalone: boolean;
}): "supported" | "ios-install-required" | "unsupported" {
  if (isIOS && !standalone) return "ios-install-required";
  return pushSupported ? "supported" : "unsupported";
}

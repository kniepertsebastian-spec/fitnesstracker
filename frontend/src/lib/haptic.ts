export function triggerHaptic(kind: "tap" | "success" | "pr" | "warning" = "tap"): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    switch (kind) {
      case "tap":
        navigator.vibrate(15);
        break;
      case "success":
        navigator.vibrate([20, 40, 30]);
        break;
      case "pr":
        navigator.vibrate([40, 60, 120]);
        break;
      case "warning":
        navigator.vibrate([80, 50, 80]);
        break;
    }
  } catch {
    // Ignore blocked vibration policy
  }
}

export function withViewTransition(update: () => void): void {
  if (typeof document !== "undefined" && "startViewTransition" in document) {
    (document as Document & { startViewTransition: (cb: () => void) => void }).startViewTransition(update);
  } else {
    update();
  }
}

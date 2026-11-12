import { unsubscribeFromPushRequest } from "../api/push.api";

// Called while the access token is still valid. A subscription left behind would keep delivering
// this account's notifications (rest timer, reminders) to a device that has been logged out —
// and to whoever signs in there next.
async function unsubscribe() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  // Server first (needs the login); the browser-side removal happens either way, so that even an
  // offline logout stops the device from receiving anything (the server then drops the dead
  // endpoint on its next send).
  await unsubscribeFromPushRequest(subscription.endpoint).catch(() => undefined);
  await subscription.unsubscribe().catch(() => undefined);
}

/** Never throws and never blocks the logout for more than a moment. */
export async function unsubscribePushOnLogout(): Promise<void> {
  const deadline = new Promise<void>((resolve) => setTimeout(resolve, 3000));
  await Promise.race([unsubscribe().catch(() => undefined), deadline]);
}

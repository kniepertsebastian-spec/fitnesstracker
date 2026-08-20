import { useCallback, useEffect, useState } from "react";
import {
  getVapidPublicKeyRequest,
  subscribeToPushRequest,
  unsubscribeFromPushRequest,
} from "../api/push.api";

export const isPushSupported = "serviceWorker" in navigator && "PushManager" in window;

// Web Push wants the VAPID key as a Uint8Array, but the server hands it over base64url-encoded
// — this is the standard conversion boilerplate for that.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

type Status = "loading" | "unsupported" | "unconfigured" | "subscribed" | "unsubscribed";

export function usePushSubscription() {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isPushSupported) {
      setStatus("unsupported");
      return;
    }
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    setStatus(subscription ? "subscribed" : "unsubscribed");
  }, []);

  useEffect(() => {
    refresh().catch(() => setStatus("unsupported"));
  }, [refresh]);

  const subscribe = useCallback(async () => {
    setError(null);
    try {
      const { publicKey } = await getVapidPublicKeyRequest();
      if (!publicKey) {
        setStatus("unconfigured");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("Benachrichtigungen wurden nicht erlaubt.");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });

      const json = subscription.toJSON();
      await subscribeToPushRequest({
        endpoint: json.endpoint as string,
        keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth },
      });
      setStatus("subscribed");
    } catch {
      setError("Anmeldung für Erinnerungen fehlgeschlagen.");
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setError(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await unsubscribeFromPushRequest(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setStatus("unsubscribed");
    } catch {
      setError("Abmelden fehlgeschlagen.");
    }
  }, []);

  return { status, error, subscribe, unsubscribe };
}

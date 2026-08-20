import type { PushSubscribeInput, VapidPublicKeyDto } from "@fitnesstracker/shared";
import { apiFetch } from "./client";

export function getVapidPublicKeyRequest() {
  return apiFetch<VapidPublicKeyDto>("/push/vapid-public-key");
}

export function subscribeToPushRequest(input: PushSubscribeInput) {
  return apiFetch<void>("/push/subscribe", { method: "POST", body: input });
}

export function unsubscribeFromPushRequest(endpoint: string) {
  return apiFetch<void>("/push/subscribe", { method: "DELETE", body: { endpoint } });
}

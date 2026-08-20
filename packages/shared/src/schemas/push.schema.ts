import { z } from "zod";

// Matches the shape of the browser's PushSubscription.toJSON() output.
export const pushSubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});
export type PushSubscribeInput = z.infer<typeof pushSubscribeSchema>;

export const pushUnsubscribeSchema = z.object({
  endpoint: z.string().url(),
});
export type PushUnsubscribeInput = z.infer<typeof pushUnsubscribeSchema>;

// `publicKey` is null when the server has no VAPID keypair configured — push is an optional
// roadmap feature, not something that should block the rest of the app from booting.
export const vapidPublicKeyDtoSchema = z.object({
  publicKey: z.string().nullable(),
});
export type VapidPublicKeyDto = z.infer<typeof vapidPublicKeyDtoSchema>;

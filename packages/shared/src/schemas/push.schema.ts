import { z } from "zod";

// The server POSTs to whatever endpoint a client registers, so only the push services that real
// browsers use are accepted — anything else would let an account make the server call arbitrary
// (internal) addresses.
const PUSH_SERVICE_HOSTS = [
  "fcm.googleapis.com", // Chrome, Edge, Brave, Android
  "updates.push.services.mozilla.com", // Firefox
  "web.push.apple.com", // Safari / iOS home-screen apps
];
const PUSH_SERVICE_SUFFIXES = [
  ".push.apple.com",
  ".notify.windows.com", // Windows Notification Service (legacy Edge)
  ".push.services.mozilla.com",
];

// Parsed by hand (this package has no DOM/Node typings, so no `URL`): https only, no credentials
// (`@`), optional default port, then a path/query/fragment.
const HTTPS_ENDPOINT = /^https:\/\/([^/?#@:\s]+)(?::443)?(?:[/?#]|$)/i;

export function isKnownPushEndpoint(value: string): boolean {
  const match = HTTPS_ENDPOINT.exec(value);
  if (!match) return false;
  const host = match[1]!.toLowerCase();
  return PUSH_SERVICE_HOSTS.includes(host) || PUSH_SERVICE_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

export const pushEndpointSchema = z
  .string()
  .url()
  .max(2048)
  .refine(isKnownPushEndpoint, "Unbekannter Push-Dienst: nur HTTPS-Endpunkte der Browser-Anbieter sind erlaubt.");

// Matches the shape of the browser's PushSubscription.toJSON() output.
export const pushSubscribeSchema = z.object({
  endpoint: pushEndpointSchema,
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});
export type PushSubscribeInput = z.infer<typeof pushSubscribeSchema>;

export const pushUnsubscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
});
export type PushUnsubscribeInput = z.infer<typeof pushUnsubscribeSchema>;

// `publicKey` is null when the server has no VAPID keypair configured — push is an optional
// roadmap feature, not something that should block the rest of the app from booting.
export const vapidPublicKeyDtoSchema = z.object({
  publicKey: z.string().nullable(),
});
export type VapidPublicKeyDto = z.infer<typeof vapidPublicKeyDtoSchema>;

// Per-reminder-type opt-out — the underlying browser push subscription is a single endpoint
// shared by every reminder kind, these flags are what actually let a user turn off just one
// kind while keeping the others (see ARCHITECTURE.md Phase 30 and the additionals-roadmap P1.7
// notification-categories rework). remindSyncErrors/remindAppUpdates have no current sender —
// see the User model's schema comment for why — but stay in the settings surface for when one
// is added, rather than as a second migration later.
export const pushSettingsDtoSchema = z.object({
  remindPhaseChange: z.boolean(),
  remindSupplements: z.boolean(),
  remindProgressPhoto: z.boolean(),
  remindWorkout: z.boolean(),
  remindPersonalRecords: z.boolean(),
  remindGoalAchievements: z.boolean(),
  remindDailyChallenge: z.boolean(),
  remindSyncErrors: z.boolean(),
  remindAppUpdates: z.boolean(),
});
export type PushSettingsDto = z.infer<typeof pushSettingsDtoSchema>;

export const updatePushSettingsSchema = pushSettingsDtoSchema.partial();
export type UpdatePushSettingsInput = z.infer<typeof updatePushSettingsSchema>;

// The rest timer's end, so the server can notify a locked phone (the page's own timer can't run
// while the OS has suspended it). Replaces any earlier one; cleared with DELETE.
export const restTimerPushSchema = z.object({
  endsAt: z.string().datetime(),
  label: z.string().max(200).optional(),
});
export type RestTimerPushInput = z.infer<typeof restTimerPushSchema>;

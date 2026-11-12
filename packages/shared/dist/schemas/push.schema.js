import { z } from "zod";
// Matches the shape of the browser's PushSubscription.toJSON() output.
export const pushSubscribeSchema = z.object({
    endpoint: z.string().url(),
    keys: z.object({
        p256dh: z.string().min(1),
        auth: z.string().min(1),
    }),
});
export const pushUnsubscribeSchema = z.object({
    endpoint: z.string().url(),
});
// `publicKey` is null when the server has no VAPID keypair configured — push is an optional
// roadmap feature, not something that should block the rest of the app from booting.
export const vapidPublicKeyDtoSchema = z.object({
    publicKey: z.string().nullable(),
});
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
export const updatePushSettingsSchema = pushSettingsDtoSchema.partial();
// The rest timer's end, so the server can notify a locked phone (the page's own timer can't run
// while the OS has suspended it). Replaces any earlier one; cleared with DELETE.
export const restTimerPushSchema = z.object({
    endsAt: z.string().datetime(),
    label: z.string().max(200).optional(),
});
//# sourceMappingURL=push.schema.js.map
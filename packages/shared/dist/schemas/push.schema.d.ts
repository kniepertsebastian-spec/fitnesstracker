import { z } from "zod";
export declare const pushSubscribeSchema: z.ZodObject<{
    endpoint: z.ZodString;
    keys: z.ZodObject<{
        p256dh: z.ZodString;
        auth: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export type PushSubscribeInput = z.infer<typeof pushSubscribeSchema>;
export declare const pushUnsubscribeSchema: z.ZodObject<{
    endpoint: z.ZodString;
}, z.core.$strip>;
export type PushUnsubscribeInput = z.infer<typeof pushUnsubscribeSchema>;
export declare const vapidPublicKeyDtoSchema: z.ZodObject<{
    publicKey: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export type VapidPublicKeyDto = z.infer<typeof vapidPublicKeyDtoSchema>;
export declare const pushSettingsDtoSchema: z.ZodObject<{
    remindPhaseChange: z.ZodBoolean;
    remindSupplements: z.ZodBoolean;
    remindProgressPhoto: z.ZodBoolean;
    remindWorkout: z.ZodBoolean;
    remindPersonalRecords: z.ZodBoolean;
    remindGoalAchievements: z.ZodBoolean;
    remindDailyChallenge: z.ZodBoolean;
    remindSyncErrors: z.ZodBoolean;
    remindAppUpdates: z.ZodBoolean;
}, z.core.$strip>;
export type PushSettingsDto = z.infer<typeof pushSettingsDtoSchema>;
export declare const updatePushSettingsSchema: z.ZodObject<{
    remindPhaseChange: z.ZodOptional<z.ZodBoolean>;
    remindSupplements: z.ZodOptional<z.ZodBoolean>;
    remindProgressPhoto: z.ZodOptional<z.ZodBoolean>;
    remindWorkout: z.ZodOptional<z.ZodBoolean>;
    remindPersonalRecords: z.ZodOptional<z.ZodBoolean>;
    remindGoalAchievements: z.ZodOptional<z.ZodBoolean>;
    remindDailyChallenge: z.ZodOptional<z.ZodBoolean>;
    remindSyncErrors: z.ZodOptional<z.ZodBoolean>;
    remindAppUpdates: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type UpdatePushSettingsInput = z.infer<typeof updatePushSettingsSchema>;
export declare const restTimerPushSchema: z.ZodObject<{
    endsAt: z.ZodString;
    label: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type RestTimerPushInput = z.infer<typeof restTimerPushSchema>;

import type { PrismaClient } from "@prisma/client";
import webpush from "web-push";
import type { PushSubscribeInput } from "@fitnesstracker/shared";
import { env } from "../../config/env.js";

// Push stays entirely inert without a configured keypair — no boot-time failure, since it's an
// optional roadmap feature (same pattern as CLAUDE_API_KEY): subscribe/send both become no-ops.
export const isPushConfigured =
  !!env.VAPID_PUBLIC_KEY && !!env.VAPID_PRIVATE_KEY && !!env.VAPID_SUBJECT;

if (isPushConfigured) {
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
}

export function subscribeToPush(prisma: PrismaClient, userId: string, input: PushSubscribeInput) {
  return prisma.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    update: { userId, p256dh: input.keys.p256dh, auth: input.keys.auth },
    create: {
      userId,
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
    },
  });
}

export async function unsubscribeFromPush(prisma: PrismaClient, userId: string, endpoint: string) {
  await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  url?: string;
}

// Sends to every subscription the user has (e.g. multiple installed devices). A subscription
// that the push service reports as gone (410) or unknown (404) is pruned — the browser will
// never revive an expired endpoint, so retrying it forever would just be dead weight.
export async function sendNotificationToUser(
  prisma: PrismaClient,
  userId: string,
  payload: PushNotificationPayload,
) {
  if (!isPushConfigured) return;

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  const body = JSON.stringify(payload);

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
        );
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } });
        } else {
          console.error("Push notification failed", { userId, endpoint: sub.endpoint, error });
        }
      }
    }),
  );
}

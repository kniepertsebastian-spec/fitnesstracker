import { describe, expect, it } from "vitest";
import { isKnownPushEndpoint, pushSubscribeSchema } from "./push.schema";

const keys = { p256dh: "p", auth: "a" };

describe("push endpoint allow-list", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/abc",
    "https://updates.push.services.mozilla.com/wpush/v2/abc",
    "https://web.push.apple.com/abc",
    "https://wns2-par02p.notify.windows.com/w/?token=abc",
  ])("accepts %s", (endpoint) => {
    expect(isKnownPushEndpoint(endpoint)).toBe(true);
    expect(pushSubscribeSchema.safeParse({ endpoint, keys }).success).toBe(true);
  });

  it.each([
    "http://fcm.googleapis.com/fcm/send/abc",
    "https://localhost/hook",
    "https://127.0.0.1/hook",
    "https://169.254.169.254/latest/meta-data",
    "https://backend:3000/api/internal",
    "https://fcm.googleapis.com.evil.example/x",
    "https://evilfcm.googleapis.com@evil.example/x",
    "https://user:pw@fcm.googleapis.com/x",
    "https://fcm.googleapis.com:8443/x",
    "not a url",
  ])("rejects %s", (endpoint) => {
    expect(isKnownPushEndpoint(endpoint)).toBe(false);
    expect(pushSubscribeSchema.safeParse({ endpoint, keys }).success).toBe(false);
  });
});

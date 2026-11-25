import Fastify from "fastify";
import cookie from "@fastify/cookie";
import { describe, expect, it } from "vitest";
import { clearRefreshCookie, cookieDomainFor, setRefreshCookie } from "./refreshCookie.js";

describe("cookieDomainFor", () => {
  it("returns nothing without a configured domain", () => {
    expect(cookieDomainFor("fitness.pwa-tree.de", "")).toBeUndefined();
  });

  it("returns the parent domain for the apex and every subdomain", () => {
    expect(cookieDomainFor("fitness.pwa-tree.de", "pwa-tree.de")).toBe("pwa-tree.de");
    expect(cookieDomainFor("kcal.pwa-tree.de", "pwa-tree.de")).toBe("pwa-tree.de");
    expect(cookieDomainFor("KCAL.PWA-TREE.DE.", "pwa-tree.de")).toBe("pwa-tree.de");
    expect(cookieDomainFor("pwa-tree.de", "pwa-tree.de")).toBe("pwa-tree.de");
  });

  it("falls back to host-only for hosts outside the domain (localhost, look-alikes)", () => {
    expect(cookieDomainFor("localhost", "pwa-tree.de")).toBeUndefined();
    expect(cookieDomainFor("evilpwa-tree.de", "pwa-tree.de")).toBeUndefined();
    expect(cookieDomainFor("pwa-tree.de.evil.com", "pwa-tree.de")).toBeUndefined();
    expect(cookieDomainFor(undefined, "pwa-tree.de")).toBeUndefined();
  });
});

function appWith(configuredDomain: string) {
  const app = Fastify();
  app.register(cookie);
  app.post("/set", async (request, reply) => {
    setRefreshCookie(request, reply, "token-123", configuredDomain);
    return { ok: true };
  });
  app.post("/clear", async (request, reply) => {
    clearRefreshCookie(request, reply, configuredDomain);
    return { ok: true };
  });
  return app;
}

function setCookieHeaders(headers: Record<string, unknown>): string[] {
  const raw = headers["set-cookie"];
  return Array.isArray(raw) ? (raw as string[]) : raw ? [String(raw)] : [];
}

describe("setRefreshCookie / clearRefreshCookie", () => {
  it("keeps the host-only cookie when no domain is configured (unchanged behavior)", async () => {
    const app = appWith("");
    const res = await app.inject({ method: "POST", url: "/set", headers: { host: "fitness.pwa-tree.de" } });
    const headers = setCookieHeaders(res.headers);
    expect(headers).toHaveLength(1);
    expect(headers[0]).toMatch(/^refreshToken=token-123;/);
    expect(headers[0]).toContain("Path=/api/auth");
    expect(headers[0]).toContain("HttpOnly");
    expect(headers[0]).toContain("SameSite=Strict");
    expect(headers[0]).not.toContain("Domain=");
  });

  it("scopes the cookie to the parent domain and deletes the old host-only cookie in the same response", async () => {
    const app = appWith("pwa-tree.de");
    const res = await app.inject({ method: "POST", url: "/set", headers: { host: "kcal.pwa-tree.de" } });
    const headers = setCookieHeaders(res.headers);
    expect(headers).toHaveLength(2);
    const scoped = headers.find((h) => h.startsWith("refreshToken=token-123"));
    expect(scoped).toContain("Domain=pwa-tree.de");
    expect(scoped).toContain("Path=/api/auth");
    const legacy = headers.find((h) => h.startsWith("refreshToken=;"));
    expect(legacy).toBeDefined();
    expect(legacy).not.toContain("Domain=");
    expect(legacy).toContain("Path=/api/auth");
  });

  it("uses a host-only cookie when the request host is outside the configured domain", async () => {
    const app = appWith("pwa-tree.de");
    const res = await app.inject({ method: "POST", url: "/set", headers: { host: "localhost:3000" } });
    const headers = setCookieHeaders(res.headers);
    expect(headers).toHaveLength(1);
    expect(headers[0]).not.toContain("Domain=");
  });

  it("clears the cookie in both scopes on logout", async () => {
    const app = appWith("pwa-tree.de");
    const res = await app.inject({ method: "POST", url: "/clear", headers: { host: "fitness.pwa-tree.de" } });
    const headers = setCookieHeaders(res.headers);
    expect(headers).toHaveLength(2);
    expect(headers.every((h) => h.startsWith("refreshToken=;"))).toBe(true);
    expect(headers.filter((h) => h.includes("Domain=pwa-tree.de"))).toHaveLength(1);
  });
});

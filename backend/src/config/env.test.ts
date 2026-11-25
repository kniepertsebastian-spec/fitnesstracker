import { describe, expect, it } from "vitest";
import { parseCookieDomain, parseEnv, parseOriginList, parseTrustProxy } from "./env.js";

const base = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  JWT_ACCESS_SECRET: "q7Zk2vH9xT4mWc8LpR1sD6yNfB3aUeJg",
  JWT_REFRESH_SECRET: "Xb5nM8cQ2rVt7YwK4pLzD1sGhF9aJeUo",
  SETUP_TOKEN: "k3Vn8Rq2Wm7Tx4Lp",
};

describe("parseTrustProxy", () => {
  it("is off when empty or false", () => {
    expect(parseTrustProxy("")).toBe(false);
    expect(parseTrustProxy("  ")).toBe(false);
    expect(parseTrustProxy("false")).toBe(false);
  });

  it("accepts true", () => {
    expect(parseTrustProxy("true")).toBe(true);
  });

  it("turns a hop count into a trust function", () => {
    const trust = parseTrustProxy("2");
    expect(typeof trust).toBe("function");
    if (typeof trust !== "function") return;
    expect([trust("10.0.0.1", 0), trust("10.0.0.2", 1), trust("203.0.113.9", 2)]).toEqual([true, true, false]);
  });

  it("accepts a comma-separated list of ranges and keywords", () => {
    expect(parseTrustProxy("loopback, uniquelocal ,10.0.0.0/8")).toEqual(["loopback", "uniquelocal", "10.0.0.0/8"]);
  });
});

describe("parseEnv", () => {
  it("accepts real secrets in production", () => {
    expect(parseEnv({ ...base, NODE_ENV: "production" }).NODE_ENV).toBe("production");
  });

  it.each(["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "SETUP_TOKEN"])(
    "rejects the .env.example placeholder for %s in production",
    (key) => {
      const placeholder = { JWT_ACCESS_SECRET: "change-me-access-secret", JWT_REFRESH_SECRET: "change-me-refresh-secret", SETUP_TOKEN: "change-me-setup-token" }[key]!;
      expect(() => parseEnv({ ...base, NODE_ENV: "production", [key]: placeholder })).toThrow(/placeholder/);
    },
  );

  it("keeps the password reset off without a RESET_TOKEN and tolerates that in production", () => {
    expect(parseEnv(base).RESET_TOKEN).toBe("");
    expect(() => parseEnv({ ...base, NODE_ENV: "production" })).not.toThrow();
  });

  it("rejects a RESET_TOKEN that is short, equal to the SETUP_TOKEN, or a placeholder in production", () => {
    expect(() => parseEnv({ ...base, RESET_TOKEN: "short" })).toThrow(/16 characters/);
    expect(() => parseEnv({ ...base, SETUP_TOKEN: "same-secret-for-both-1234", RESET_TOKEN: "same-secret-for-both-1234" })).toThrow(/differ/);
    expect(() => parseEnv({ ...base, NODE_ENV: "production", RESET_TOKEN: "change-me-reset-token-xx" })).toThrow(/placeholder/);
  });

  it("still lets development and CI start with throwaway values", () => {
    expect(() => parseEnv({ ...base, NODE_ENV: "development", JWT_ACCESS_SECRET: "change-me-access-secret" })).not.toThrow();
    expect(() => parseEnv({ ...base, JWT_ACCESS_SECRET: "ci-access-secret-not-a-real-secret" })).not.toThrow();
  });

  it("defaults the proxy trust to off and the heavy-route limit to 10 per minute", () => {
    const parsed = parseEnv(base);
    expect(parsed.TRUST_PROXY).toBe(false);
    expect(parsed.HEAVY_RATE_LIMIT_PER_MINUTE).toBe(10);
  });
});

describe("cookie SSO and CORS settings", () => {
  it("normalizes COOKIE_DOMAIN and keeps it empty by default", () => {
    expect(parseCookieDomain(" .PWA-Tree.de ")).toBe("pwa-tree.de");
    expect(parseEnv(base).COOKIE_DOMAIN).toBe("");
    expect(parseEnv({ ...base, COOKIE_DOMAIN: ".pwa-tree.de" }).COOKIE_DOMAIN).toBe("pwa-tree.de");
  });

  it("rejects a COOKIE_DOMAIN with a scheme, port or without a dot", () => {
    for (const bad of ["https://pwa-tree.de", "pwa-tree.de:443", "localhost"]) {
      expect(() => parseEnv({ ...base, COOKIE_DOMAIN: bad })).toThrow(/COOKIE_DOMAIN/);
    }
  });

  it("parses CORS_EXTRA_ORIGINS as a list of origins", () => {
    expect(parseOriginList(" https://kcal.pwa-tree.de/ , http://localhost:5174,")).toEqual(["https://kcal.pwa-tree.de", "http://localhost:5174"]);
    expect(parseEnv(base).CORS_EXTRA_ORIGINS).toEqual([]);
    expect(() => parseEnv({ ...base, CORS_EXTRA_ORIGINS: "kcal.pwa-tree.de" })).toThrow(/CORS_EXTRA_ORIGINS/);
  });

  it("accepts only redis:// URLs for REDIS_URL", () => {
    expect(parseEnv({ ...base, REDIS_URL: "redis://redis:6379" }).REDIS_URL).toBe("redis://redis:6379");
    expect(() => parseEnv({ ...base, REDIS_URL: "http://redis" })).toThrow(/REDIS_URL/);
  });
});

import { describe, expect, it } from "vitest";
import { parseEnv, parseTrustProxy } from "./env.js";

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

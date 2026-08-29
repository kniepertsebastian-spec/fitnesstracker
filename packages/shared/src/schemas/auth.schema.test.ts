import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "./auth.schema.js";

describe("registerSchema", () => {
  const valid = { email: "user@example.com", password: "password123", setupToken: "secret-token" };

  it("accepts a well-formed registration", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it("requires an invite setup token — registration is gated, not public", () => {
    expect(registerSchema.safeParse({ ...valid, setupToken: "" }).success).toBe(false);
  });

  it("rejects a password under 8 characters", () => {
    expect(registerSchema.safeParse({ ...valid, password: "short1" }).success).toBe(false);
  });

  it("treats an empty displayName the same as omitted, not a validation error", () => {
    const result = registerSchema.safeParse({ ...valid, displayName: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.displayName).toBeUndefined();
  });

  it("rejects an invalid email", () => {
    expect(registerSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts any non-empty password (server verifies the actual hash)", () => {
    expect(loginSchema.safeParse({ email: "user@example.com", password: "x" }).success).toBe(true);
  });

  it("rejects an empty password", () => {
    expect(loginSchema.safeParse({ email: "user@example.com", password: "" }).success).toBe(false);
  });
});

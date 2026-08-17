import { randomBytes, createHash } from "node:crypto";

export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const REFRESH_COOKIE_NAME = "refreshToken";

// Refresh tokens are high-entropy opaque strings (not JWTs) so they can be revoked/rotated
// server-side. Only the SHA-256 hash is stored — a random token doesn't need bcrypt's
// deliberate slowness, and hashing means a DB leak alone doesn't yield usable tokens.
export function generateRefreshToken(): string {
  return randomBytes(48).toString("base64url");
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

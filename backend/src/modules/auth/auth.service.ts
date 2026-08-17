import type { PrismaClient, User } from "@prisma/client";
import type { RegisterInput } from "@fitnesstracker/shared";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { generateRefreshToken, hashRefreshToken, REFRESH_TOKEN_TTL_MS } from "../../lib/tokens.js";
import { ConflictError, ForbiddenError, UnauthorizedError } from "../../errors/httpErrors.js";
import { env } from "../../config/env.js";

export async function registerUser(prisma: PrismaClient, input: RegisterInput): Promise<User> {
  if (input.setupToken !== env.SETUP_TOKEN) {
    throw new ForbiddenError("Invalid setup token");
  }

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new ConflictError("Email already registered");
  }

  const passwordHash = await hashPassword(input.password);
  return prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      displayName: input.displayName,
    },
  });
}

export async function verifyCredentials(
  prisma: PrismaClient,
  email: string,
  password: string,
): Promise<User> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new UnauthorizedError("Invalid email or password");
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new UnauthorizedError("Invalid email or password");
  }
  return user;
}

export async function issueRefreshToken(prisma: PrismaClient, userId: string): Promise<string> {
  const rawToken = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashRefreshToken(rawToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });
  return rawToken;
}

// Rotates a valid refresh token: revokes the presented one and issues a fresh one.
// Any presented token that is missing, expired, or already revoked is treated as unauthorized —
// a revoked-but-presented token is a signal of possible token theft/reuse, so it is not
// silently accepted either way.
export async function rotateRefreshToken(
  prisma: PrismaClient,
  rawToken: string,
): Promise<{ userId: string; newRawToken: string }> {
  const tokenHash = hashRefreshToken(rawToken);
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
    throw new UnauthorizedError("Invalid refresh token");
  }

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() },
  });

  const newRawToken = await issueRefreshToken(prisma, existing.userId);
  return { userId: existing.userId, newRawToken };
}

export async function revokeRefreshToken(prisma: PrismaClient, rawToken: string): Promise<void> {
  const tokenHash = hashRefreshToken(rawToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

import { timingSafeEqual } from "node:crypto";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { generateRefreshToken, hashRefreshToken, REFRESH_TOKEN_TTL_MS } from "../../lib/tokens.js";
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from "../../errors/httpErrors.js";
import { env } from "../../config/env.js";
// The setup token is the operator's secret: it gates registration (any number of accounts, each
// with its own, fully separated data) and the mail-less password reset.
function assertSetupToken(given) {
    const a = Buffer.from(given);
    const b = Buffer.from(env.SETUP_TOKEN);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
        throw new ForbiddenError("Invalid setup token");
    }
}
export async function registerUser(prisma, input) {
    assertSetupToken(input.setupToken);
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
export async function verifyCredentials(prisma, email, password) {
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
export async function issueRefreshToken(prisma, userId) {
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
// A token that was just rotated may legitimately arrive again: a second tab refreshing at the
// same moment, or a response that got lost on a bad connection so the client still holds the old
// cookie. Within this window the old token still gets a new one instead of logging the user out.
export const REFRESH_GRACE_MS = 30_000;
// Rotates a valid refresh token: marks the presented one as used and issues a fresh one.
// A missing or expired token — or one rotated longer than the grace period ago — is unauthorized.
// Logging out, changing the password and deleting the account remove the rows, so a token that
// was revoked on purpose never gets a grace period.
export async function rotateRefreshToken(prisma, rawToken, now = new Date()) {
    const tokenHash = hashRefreshToken(rawToken);
    const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!existing || existing.expiresAt < now) {
        throw new UnauthorizedError("Invalid refresh token");
    }
    if (existing.revokedAt) {
        if (now.getTime() - existing.revokedAt.getTime() > REFRESH_GRACE_MS) {
            throw new UnauthorizedError("Invalid refresh token");
        }
        return { userId: existing.userId, newRawToken: await issueRefreshToken(prisma, existing.userId) };
    }
    await prisma.refreshToken.update({ where: { id: existing.id }, data: { revokedAt: now } });
    return { userId: existing.userId, newRawToken: await issueRefreshToken(prisma, existing.userId) };
}
// Logout: the row is removed (not just marked), so the token can't ride the rotation grace period.
export async function revokeRefreshToken(prisma, rawToken) {
    await prisma.refreshToken.deleteMany({ where: { tokenHash: hashRefreshToken(rawToken) } });
}
// Ends every session of the account except (optionally) the one the request came from.
async function endOtherSessions(prisma, userId, keepRawToken) {
    await prisma.refreshToken.deleteMany({
        where: {
            userId,
            ...(keepRawToken ? { NOT: { tokenHash: hashRefreshToken(keepRawToken) } } : {}),
        },
    });
}
export async function changePassword(prisma, userId, input, keepRawToken) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user)
        throw new UnauthorizedError();
    if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
        throw new ForbiddenError("Current password is wrong");
    }
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(input.newPassword) } });
    await endOtherSessions(prisma, userId, keepRawToken);
}
export async function resetPassword(prisma, input) {
    assertSetupToken(input.setupToken);
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user)
        throw new NotFoundError("No account with this email");
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(input.newPassword) } });
    await endOtherSessions(prisma, user.id);
}
// Removes the account and, through the schema's cascades, everything it owns. The photo files
// live outside the database, so their names are collected first and the files removed afterwards.
export async function deleteAccount(prisma, userId, password) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user)
        throw new UnauthorizedError();
    if (!(await verifyPassword(password, user.passwordHash))) {
        throw new ForbiddenError("Password is wrong");
    }
    const photos = await prisma.progressPhoto.findMany({ where: { userId }, select: { filename: true } });
    await prisma.user.delete({ where: { id: userId } });
    return photos.map((p) => p.filename);
}
//# sourceMappingURL=auth.service.js.map
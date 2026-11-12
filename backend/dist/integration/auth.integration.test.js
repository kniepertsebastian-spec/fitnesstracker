import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { env } from "../config/env.js";
import { REFRESH_GRACE_MS } from "../modules/auth/auth.service.js";
import { hashRefreshToken } from "../lib/tokens.js";
import { PASSWORD, authed, hasTestDb, login, refresh, refreshCookieOf, register, signUp, startApp, uniqueEmail, } from "./testApp.js";
describe.skipIf(!hasTestDb)("auth (integration)", () => {
    let app;
    beforeAll(async () => {
        app = await startApp();
    });
    afterAll(async () => {
        await app.close();
    });
    describe("registration and login", () => {
        it("rejects a wrong setup token and accepts the right one", async () => {
            const email = uniqueEmail("setup");
            const bad = await app.inject({
                method: "POST",
                url: "/api/auth/register",
                payload: { email, password: PASSWORD, setupToken: "nope" },
            });
            expect(bad.statusCode).toBe(403);
            expect((await register(app, email)).statusCode).toBe(201);
        });
        it("answers 400 with the validation issues for a malformed body (zod error handling)", async () => {
            const res = await app.inject({
                method: "POST",
                url: "/api/auth/register",
                payload: { email: "not-an-email", password: "short", setupToken: env.SETUP_TOKEN },
            });
            expect(res.statusCode).toBe(400);
            expect(res.json().message).toBe("Validation error");
            expect(res.json().issues.length).toBeGreaterThanOrEqual(2);
        });
        it("allows several accounts, but not the same email twice", async () => {
            const email = uniqueEmail("dup");
            expect((await register(app, email)).statusCode).toBe(201);
            expect((await register(app, email)).statusCode).toBe(409);
            expect((await register(app, uniqueEmail("second"))).statusCode).toBe(201);
        });
        it("logs in with the right password only, and /me needs the access token", async () => {
            const session = await signUp(app, "login");
            expect((await login(app, session.email, "wrong-password")).statusCode).toBe(401);
            expect((await app.inject({ method: "GET", url: "/api/auth/me" })).statusCode).toBe(401);
            const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: authed(session) });
            expect(me.statusCode).toBe(200);
            expect(me.json()).toMatchObject({ id: session.id, email: session.email });
            expect(me.body).not.toContain("passwordHash");
        });
    });
    describe("refresh tokens", () => {
        it("rotates the token on every refresh", async () => {
            const session = await signUp(app, "rotate");
            const res = await refresh(app, session.refreshToken);
            expect(res.statusCode).toBe(200);
            expect(res.json().accessToken).toEqual(expect.any(String));
            const next = refreshCookieOf(res);
            expect(next).toBeTruthy();
            expect(next).not.toBe(session.refreshToken);
            expect((await refresh(app, next)).statusCode).toBe(200);
        });
        it("gives a just-rotated token a short grace period (parallel tab / lost response)", async () => {
            const session = await signUp(app, "grace");
            expect((await refresh(app, session.refreshToken)).statusCode).toBe(200);
            // The same, already rotated cookie arrives again right away: still the same user, new token.
            const again = await refresh(app, session.refreshToken);
            expect(again.statusCode).toBe(200);
            expect(refreshCookieOf(again)).toBeTruthy();
        });
        it("rejects a rotated token once the grace period is over", async () => {
            const session = await signUp(app, "expired");
            expect((await refresh(app, session.refreshToken)).statusCode).toBe(200);
            await app.prisma.refreshToken.update({
                where: { tokenHash: hashRefreshToken(session.refreshToken) },
                data: { revokedAt: new Date(Date.now() - REFRESH_GRACE_MS - 5_000) },
            });
            expect((await refresh(app, session.refreshToken)).statusCode).toBe(401);
        });
        it("rejects an expired token and a missing cookie", async () => {
            const session = await signUp(app, "ttl");
            await app.prisma.refreshToken.update({
                where: { tokenHash: hashRefreshToken(session.refreshToken) },
                data: { expiresAt: new Date(Date.now() - 1000) },
            });
            expect((await refresh(app, session.refreshToken)).statusCode).toBe(401);
            expect((await app.inject({ method: "POST", url: "/api/auth/refresh" })).statusCode).toBe(401);
        });
        it("logout ends the session for good — no grace period for a deliberately revoked token", async () => {
            const session = await signUp(app, "logout");
            const out = await app.inject({
                method: "POST",
                url: "/api/auth/logout",
                cookies: { refreshToken: session.refreshToken },
            });
            expect(out.statusCode).toBe(204);
            expect((await refresh(app, session.refreshToken)).statusCode).toBe(401);
        });
    });
    describe("password change", () => {
        it("needs the current password, and ends the other sessions but not the current one", async () => {
            const session = await signUp(app, "pwchange");
            const other = await login(app, session.email); // a second device
            const otherToken = refreshCookieOf(other);
            const wrong = await app.inject({
                method: "PUT",
                url: "/api/auth/me/password",
                headers: authed(session),
                cookies: { refreshToken: session.refreshToken },
                payload: { currentPassword: "not-my-password", newPassword: "a-brand-new-password" },
            });
            expect(wrong.statusCode).toBe(403);
            const ok = await app.inject({
                method: "PUT",
                url: "/api/auth/me/password",
                headers: authed(session),
                cookies: { refreshToken: session.refreshToken },
                payload: { currentPassword: PASSWORD, newPassword: "a-brand-new-password" },
            });
            expect(ok.statusCode).toBe(204);
            expect((await login(app, session.email, PASSWORD)).statusCode).toBe(401);
            expect((await login(app, session.email, "a-brand-new-password")).statusCode).toBe(200);
            expect((await refresh(app, otherToken)).statusCode).toBe(401);
            expect((await refresh(app, session.refreshToken)).statusCode).toBe(200);
        });
    });
    describe("password reset (gated by the setup token, there is no mail)", () => {
        it("rejects a wrong setup token and an unknown account", async () => {
            const session = await signUp(app, "reset-bad");
            const badToken = await app.inject({
                method: "POST",
                url: "/api/auth/reset-password",
                payload: { email: session.email, setupToken: "nope", newPassword: "another-new-password" },
            });
            expect(badToken.statusCode).toBe(403);
            const unknown = await app.inject({
                method: "POST",
                url: "/api/auth/reset-password",
                payload: { email: uniqueEmail("ghost"), setupToken: env.SETUP_TOKEN, newPassword: "another-new-password" },
            });
            expect(unknown.statusCode).toBe(404);
            expect((await login(app, session.email)).statusCode).toBe(200);
        });
        it("sets the new password and signs every device out", async () => {
            const session = await signUp(app, "reset");
            const res = await app.inject({
                method: "POST",
                url: "/api/auth/reset-password",
                payload: { email: session.email, setupToken: env.SETUP_TOKEN, newPassword: "another-new-password" },
            });
            expect(res.statusCode).toBe(204);
            expect((await login(app, session.email)).statusCode).toBe(401);
            expect((await login(app, session.email, "another-new-password")).statusCode).toBe(200);
            expect((await refresh(app, session.refreshToken)).statusCode).toBe(401);
        });
    });
    describe("account deletion", () => {
        it("asks for the password, then removes the account and everything it owns", async () => {
            const session = await signUp(app, "delete");
            await app.inject({
                method: "POST",
                url: "/api/supplements",
                headers: authed(session),
                payload: { name: "Creatine", reminderTime: "08:00", timeZone: "Europe/Berlin" },
            });
            const wrong = await app.inject({
                method: "DELETE",
                url: "/api/auth/me",
                headers: authed(session),
                payload: { password: "wrong" },
            });
            expect(wrong.statusCode).toBe(403);
            expect(await app.prisma.user.count({ where: { id: session.id } })).toBe(1);
            const res = await app.inject({
                method: "DELETE",
                url: "/api/auth/me",
                headers: authed(session),
                payload: { password: PASSWORD },
            });
            expect(res.statusCode).toBe(204);
            expect(await app.prisma.user.count({ where: { id: session.id } })).toBe(0);
            expect(await app.prisma.supplement.count({ where: { userId: session.id } })).toBe(0);
            expect(await app.prisma.refreshToken.count({ where: { userId: session.id } })).toBe(0);
            expect((await login(app, session.email)).statusCode).toBe(401);
        });
    });
});
//# sourceMappingURL=auth.integration.test.js.map
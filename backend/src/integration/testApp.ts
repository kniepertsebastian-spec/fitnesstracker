import { randomUUID } from "node:crypto";
import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import { buildApp } from "../app.js";
import { env } from "../config/env.js";

// Integration tests run against a real Postgres (TEST_DATABASE_URL, see vitest.config.ts) and are
// skipped without one, so `pnpm test` still works on a machine that has no database.
export const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);

export const PASSWORD = "correct-horse-battery";

export async function startApp(): Promise<FastifyInstance> {
  const app = buildApp({ logger: false });
  await app.ready();
  return app;
}

export function uniqueEmail(label: string): string {
  return `${label}-${randomUUID()}@integration.test`;
}

export interface Session {
  id: string;
  email: string;
  accessToken: string;
  refreshToken: string;
}

export function refreshCookieOf(res: LightMyRequestResponse): string | undefined {
  return res.cookies.find((cookie) => cookie.name === "refreshToken")?.value;
}

export async function register(app: FastifyInstance, email: string, password = PASSWORD) {
  return app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email, password, setupToken: env.SETUP_TOKEN },
  });
}

export async function login(app: FastifyInstance, email: string, password = PASSWORD) {
  return app.inject({ method: "POST", url: "/api/auth/login", payload: { email, password } });
}

export async function signUp(app: FastifyInstance, label: string): Promise<Session> {
  const email = uniqueEmail(label);
  const registered = await register(app, email);
  if (registered.statusCode !== 201) throw new Error(`register failed: ${registered.body}`);
  const res = await login(app, email);
  if (res.statusCode !== 200) throw new Error(`login failed: ${res.body}`);
  const body = res.json() as { user: { id: string }; accessToken: string };
  return { id: body.user.id, email, accessToken: body.accessToken, refreshToken: refreshCookieOf(res)! };
}

// The operator account (OPERATOR_EMAIL, set in vitest.config.ts); created on first use.
export async function operatorSession(app: FastifyInstance): Promise<Session> {
  const email = env.OPERATOR_EMAIL;
  await register(app, email); // 409 when an earlier run already created it
  const res = await login(app, email);
  if (res.statusCode !== 200) throw new Error(`operator login failed: ${res.body}`);
  const body = res.json() as { user: { id: string }; accessToken: string };
  return { id: body.user.id, email, accessToken: body.accessToken, refreshToken: refreshCookieOf(res)! };
}

export function authed(session: Session) {
  return { authorization: `Bearer ${session.accessToken}` };
}

export function refresh(app: FastifyInstance, refreshToken: string) {
  return app.inject({ method: "POST", url: "/api/auth/refresh", cookies: { refreshToken } });
}

// Minimal multipart body with one file part, so the upload route can be exercised through inject().
export function multipartFile(field: string, filename: string, contentType: string, data: Buffer) {
  const boundary = `----integration${randomUUID().replace(/-/g, "")}`;
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    payload: Buffer.concat([head, data, tail]),
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
  };
}

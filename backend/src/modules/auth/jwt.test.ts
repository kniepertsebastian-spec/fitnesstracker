import Fastify from "fastify";
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import jwtPlugin from "../../plugins/jwt.plugin.js";
import { env } from "../../config/env.js";

async function build() {
  const app = Fastify();
  await app.register(jwtPlugin);
  app.get("/me", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.code(401).send({ message: "Unauthorized" });
    }
    return { sub: request.user.sub };
  });
  return app;
}

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
function forge(header: object, payload: object, secret: string | null) {
  const head = `${b64(header)}.${b64(payload)}`;
  const signature = secret === null ? "" : createHmac("sha256", secret).update(head).digest("base64url");
  return `${head}.${signature}`;
}
const inOneHour = () => Math.floor(Date.now() / 1000) + 3600;

describe("access token verification", () => {
  it("accepts a token this server signed", async () => {
    const app = await build();
    const token = app.jwt.sign({ sub: "user-1" });
    const response = await app.inject({ url: "/me", headers: { authorization: `Bearer ${token}` } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ sub: "user-1" });
  });

  it("rejects a token signed with another secret", async () => {
    const app = await build();
    const token = forge({ alg: "HS256", typ: "JWT" }, { sub: "user-1", exp: inOneHour() }, "not-the-servers-secret-at-all");
    const response = await app.inject({ url: "/me", headers: { authorization: `Bearer ${token}` } });
    expect(response.statusCode).toBe(401);
  });

  it("rejects an unsigned token (alg none)", async () => {
    const app = await build();
    const token = forge({ alg: "none", typ: "JWT" }, { sub: "user-1", exp: inOneHour() }, null);
    const response = await app.inject({ url: "/me", headers: { authorization: `Bearer ${token}` } });
    expect(response.statusCode).toBe(401);
  });

  it("rejects an expired token", async () => {
    const app = await build();
    const token = forge({ alg: "HS256", typ: "JWT" }, { sub: "user-1", exp: Math.floor(Date.now() / 1000) - 60 }, env.JWT_ACCESS_SECRET);
    const response = await app.inject({ url: "/me", headers: { authorization: `Bearer ${token}` } });
    expect(response.statusCode).toBe(401);
  });

  it("rejects a request without a token", async () => {
    const app = await build();
    expect((await app.inject({ url: "/me" })).statusCode).toBe(401);
  });
});

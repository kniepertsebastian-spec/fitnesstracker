import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { describe, expect, it } from "vitest";
import { parseTrustProxy } from "./env.js";
// The setup of docker-compose.prod.yml: Cloudflare -> cloudflared -> Caddy -> backend, everything
// behind the first hop on private addresses.
const PROD_TRUST = parseTrustProxy("loopback,linklocal,uniquelocal");
async function build(trustProxy) {
    const app = Fastify({ trustProxy });
    await app.register(rateLimit, { global: false });
    app.get("/ip", async (request) => ({ ip: request.ip }));
    app.get("/limited", { config: { rateLimit: { max: 2, timeWindow: "1 minute" } } }, async () => ({ ok: true }));
    return app;
}
describe("client IP behind the proxy chain", () => {
    it("takes the first untrusted address from the right, not what the client prepended", async () => {
        const app = await build(PROD_TRUST);
        const response = await app.inject({
            url: "/ip",
            remoteAddress: "172.18.0.3", // Caddy
            headers: { "x-forwarded-for": "6.6.6.6, 203.0.113.9, 172.18.0.2" }, // spoof, real visitor (from Cloudflare), cloudflared
        });
        expect(response.json()).toEqual({ ip: "203.0.113.9" });
    });
    it("without trust every request is the proxy (the old, shared-bucket behaviour)", async () => {
        const app = await build(false);
        const response = await app.inject({
            url: "/ip",
            remoteAddress: "172.18.0.3",
            headers: { "x-forwarded-for": "203.0.113.9" },
        });
        expect(response.json()).toEqual({ ip: "172.18.0.3" });
    });
    it("does not trust X-Forwarded-For from an untrusted peer", async () => {
        const app = await build(PROD_TRUST);
        const response = await app.inject({
            url: "/ip",
            remoteAddress: "198.51.100.7", // someone reaching the backend directly
            headers: { "x-forwarded-for": "203.0.113.9" },
        });
        expect(response.json()).toEqual({ ip: "198.51.100.7" });
    });
    it("rate-limits each visitor separately", async () => {
        const app = await build(PROD_TRUST);
        const from = (visitor) => app.inject({ url: "/limited", remoteAddress: "172.18.0.3", headers: { "x-forwarded-for": `${visitor}, 172.18.0.2` } });
        expect((await from("203.0.113.1")).statusCode).toBe(200);
        expect((await from("203.0.113.1")).statusCode).toBe(200);
        expect((await from("203.0.113.1")).statusCode).toBe(429);
        // A different visitor is not affected by the first one's limit.
        expect((await from("203.0.113.2")).statusCode).toBe(200);
    });
});
//# sourceMappingURL=trustProxy.test.js.map
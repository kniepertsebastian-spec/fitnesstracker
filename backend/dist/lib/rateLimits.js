import { env } from "../config/env.js";
/**
 * Route options for the expensive endpoints (AI calls, video and photo upload, full data export).
 * `@fastify/rate-limit` is registered with `global: false`, so a route is only limited when it
 * passes this as its options. Keyed by client IP (the limit hook runs before authentication), which
 * only means something with a correct TRUST_PROXY (config/env.ts).
 */
export const HEAVY_RATE_LIMIT = {
    config: { rateLimit: { max: env.HEAVY_RATE_LIMIT_PER_MINUTE, timeWindow: "1 minute" } },
};
//# sourceMappingURL=rateLimits.js.map
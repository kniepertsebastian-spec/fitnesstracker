import { Redis } from "ioredis";

/**
 * One shared Redis connection for the backend (rate-limit store, AI budgets). Fails fast instead of
 * queueing: with Redis down a request must not hang. The rate limiter is registered with
 * `skipOnError` (an outage lifts the limits instead of failing every login); the AI budget fails
 * closed (see aiBudget.ts).
 */
export function createRedis(url: string): Redis {
  return new Redis(url, {
    connectTimeout: 2_000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: false,
  });
}

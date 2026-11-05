import { z } from "zod";

/**
 * `TRUST_PROXY` -> Fastify-`trustProxy`. Leer/"false" = kein Proxy (die direkte Verbindung ist der
 * Client, richtig für lokale Entwicklung), "true" = jedem Hop vertrauen (nur, wenn die erste Station
 * die Header selbst überschreibt), Zahl = Anzahl vertrauenswürdiger Hops ab der direkten Verbindung, sonst eine
 * kommagetrennte Liste von IPs/CIDRs oder proxy-addr-Schlüsselwörtern (loopback, linklocal,
 * uniquelocal). Bei einer Liste zählt der erste NICHT vertrauenswürdige Eintrag von rechts im
 * `X-Forwarded-For` als Client: ein vom Client vorangestellter Eintrag wird nicht übernommen.
 */
export type TrustProxy = boolean | string[] | ((address: string, hop: number) => boolean);

export function parseTrustProxy(raw: string): TrustProxy {
  const value = raw.trim();
  if (value === "" || value.toLowerCase() === "false") return false;
  if (value.toLowerCase() === "true") return true;
  if (/^\d+$/.test(value)) {
    // Fastify's types only list the function form; this is what a hop count means (as in proxy-addr).
    const hops = Number(value);
    return (_address, hop) => hop < hops;
  }
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

// Werte aus `.env.example`, die nie in Produktion landen dürfen: Wer die Datei unverändert kopiert,
// hätte sonst ein öffentlich bekanntes JWT-Secret. Gilt nur mit NODE_ENV=production, damit lokale
// Entwicklung und CI (Wegwerf-Werte) weiter starten.
const PLACEHOLDER_SECRET = /change-?me|changeme|your-secret|example|placeholder/i;
const SECRETS_TO_CHECK = ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "SETUP_TOKEN"] as const;

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET must be at least 16 characters"),
    JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET must be at least 16 characters"),
    SETUP_TOKEN: z.string().min(8, "SETUP_TOKEN must be at least 8 characters"),
    FRONTEND_ORIGIN: z.string().url().default("http://localhost:5173"),
    // Requests per minute and IP on /auth/login and /auth/register. Keep the default in production;
    // only the CI raises it, because every E2E scenario registers and logs in its own account from
    // the same IP and the suite outgrew five per minute.
    AUTH_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).max(1000).default(5),
    // Requests per minute and IP on the routes that are expensive (AI calls, video/photo upload,
    // full data export).
    HEAVY_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).max(1000).default(10),
    // Which proxies in front of the backend may set X-Forwarded-For (see parseTrustProxy). Without
    // it every request appears to come from the proxy's IP, and the per-IP rate limits above become
    // one shared bucket for all visitors.
    TRUST_PROXY: z.string().optional().default("").transform(parseTrustProxy),
    COOKIE_SECURE: z
      .string()
      .default("false")
      .transform((val) => val === "true"),
    // Push stays inert (subscribe/send both no-op) until all three are set — "absent means
    // disabled, not a boot-time error".
    VAPID_PUBLIC_KEY: z.string().optional().default(""),
    VAPID_PRIVATE_KEY: z.string().optional().default(""),
    VAPID_SUBJECT: z.string().optional().default(""),
    // Resolved relative to the backend package's cwd (matches every other relative path in this
    // project, e.g. the prisma schema/migrations paths above).
    UPLOADS_DIR: z.string().min(1).default("./uploads"),
    // Master key (32 bytes, hex-encoded = 64 chars) for encrypting BYOK AI provider API keys at
    // rest (Phase 19). Same "absent means disabled, not a boot-time error" pattern as VAPID — the
    // AI settings routes respond with a clear "not configured" instead of crashing the whole
    // backend over a feature nobody has to use.
    AI_SETTINGS_ENCRYPTION_KEY: z
      .string()
      .optional()
      .default("")
      .refine((val) => val === "" || /^[0-9a-fA-F]{64}$/.test(val), {
        message: "AI_SETTINGS_ENCRYPTION_KEY must be 64 hex characters (32 bytes) when set",
      }),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV !== "production") return;
    for (const key of SECRETS_TO_CHECK) {
      if (PLACEHOLDER_SECRET.test(value[key])) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} still holds a placeholder value from .env.example — set your own long random value before running in production`,
        });
      }
    }
  });

export function parseEnv(source: NodeJS.ProcessEnv) {
  return envSchema.parse(source);
}

// Fail fast on boot rather than crashing mysteriously on the first request that needs a var.
export const env = parseEnv(process.env);
export type Env = typeof env;

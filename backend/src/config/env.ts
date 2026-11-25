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

/**
 * `COOKIE_DOMAIN` -> Domain-Attribut des Refresh-Cookies. Leer = host-only (bisheriges Verhalten).
 * Gesetzt (z. B. `pwa-tree.de`), teilen sich alle Subdomains (Fitnesstracker, Kalorientracker) eine
 * Sitzung. Ein führender Punkt ist erlaubt (`.pwa-tree.de`), wird aber entfernt — Browser behandeln
 * beide Schreibweisen gleich, und `cookieDomainFor` vergleicht ohne ihn.
 */
export function parseCookieDomain(raw: string): string {
  return raw.trim().toLowerCase().replace(/^\.+/, "");
}

/** Kommagetrennte Liste zusätzlicher Origins (z. B. die Kalorien-PWA im Dev-Betrieb). */
export function parseOriginList(raw: string): string[] {
  return raw
    .split(",")
    .map((entry) => entry.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

// Werte aus `.env.example`, die nie in Produktion landen dürfen: Wer die Datei unverändert kopiert,
// hätte sonst ein öffentlich bekanntes JWT-Secret. Gilt nur mit NODE_ENV=production, damit lokale
// Entwicklung und CI (Wegwerf-Werte) weiter starten.
const PLACEHOLDER_SECRET = /change-?me|changeme|your-secret|example|placeholder/i;
const SECRETS_TO_CHECK = ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "SETUP_TOKEN", "RESET_TOKEN"] as const;

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET must be at least 16 characters"),
    JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET must be at least 16 characters"),
    SETUP_TOKEN: z.string().min(8, "SETUP_TOKEN must be at least 8 characters"),
    // Operator secret for the mail-less password reset, separate from SETUP_TOKEN: the setup token
    // is handed to anyone who may register, and must not let them take over other accounts. Empty
    // = password reset is switched off.
    RESET_TOKEN: z
      .string()
      .optional()
      .default("")
      .refine((val) => val === "" || val.length >= 16, { message: "RESET_TOKEN must be at least 16 characters when set" }),
    // The operator account may import the exercise catalog and edit/delete catalog exercises (the
    // ones nobody owns). Empty = the oldest account is the operator, which is the one created
    // with the setup token.
    OPERATOR_EMAIL: z.string().optional().default(""),
    FRONTEND_ORIGIN: z.string().url().default("http://localhost:5173"),
    // Further origins allowed to call the API with credentials, comma-separated (e.g. the
    // Kalorientracker dev server http://localhost:5174). In production both PWAs reach the API
    // same-origin through Caddy, so this only matters for cross-origin setups.
    CORS_EXTRA_ORIGINS: z
      .string()
      .optional()
      .default("")
      .transform(parseOriginList)
      .refine((origins) => origins.every((origin) => /^https?:\/\/[^/\s]+$/.test(origin)), {
        message: "CORS_EXTRA_ORIGINS must be a comma-separated list of origins like https://kcal.example.com",
      }),
    // Shared parent domain for the refresh cookie (cookie SSO across subdomains), e.g. pwa-tree.de.
    // Empty = host-only cookie, as before. Only applied to requests whose host lies under it, so a
    // request via localhost or another hostname still gets a working host-only cookie.
    COOKIE_DOMAIN: z
      .string()
      .optional()
      .default("")
      .transform(parseCookieDomain)
      .refine((val) => val === "" || /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(val), {
        message: "COOKIE_DOMAIN must be a domain like pwa-tree.de (no scheme, no port)",
      }),
    // Redis (BullMQ queues, shared rate-limit store, AI budgets). Empty = in-memory rate limits and
    // in-memory AI budgets, which is right for a single backend instance and for tests.
    REDIS_URL: z
      .string()
      .optional()
      .default("")
      .refine((val) => val === "" || /^rediss?:\/\//.test(val), { message: "REDIS_URL must start with redis:// or rediss://" }),
    // Media storage for the nutrition features (nutrition-label photos, cookbook pages, temporary
    // videos). A volume in production, separate from UPLOADS_DIR; never stored in PostgreSQL.
    MEDIA_DIR: z.string().min(1).default("./media"),
    MEDIA_MAX_UPLOAD_MB: z.coerce.number().positive().max(100).default(10),
    // Longest edge after downscaling; label and cookbook photos stay readable for OCR/AI at 2048 px.
    MEDIA_MAX_IMAGE_EDGE_PX: z.coerce.number().int().min(256).max(8192).default(2048),
    MEDIA_WEBP_QUALITY: z.coerce.number().int().min(1).max(100).default(80),
    // Daily AI call budgets (Europe/Berlin calendar day), per user and across all users.
    AI_DAILY_BUDGET_PER_USER: z.coerce.number().int().min(0).default(50),
    AI_DAILY_BUDGET_GLOBAL: z.coerce.number().int().min(0).default(300),
    // Requests per minute and IP on /auth/login and /auth/register. Keep the default in production;
    // only the CI raises it, because every E2E scenario registers and logs in its own account from
    // the same IP and the suite outgrew five per minute.
    AUTH_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).max(1000).default(5),
    // Requests per minute and IP on the routes that are expensive (AI calls, video/photo upload,
    // full data export).
    HEAVY_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).max(1000).default(10),
    // Requests per minute and IP on /auth/refresh. Every app start (each tab) refreshes once, so 30
    // leaves room for several tabs while stopping a burst; the CI raises it for the E2E suite.
    REFRESH_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).max(1000).default(30),
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
    if (value.RESET_TOKEN !== "" && value.RESET_TOKEN === value.SETUP_TOKEN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["RESET_TOKEN"],
        message: "RESET_TOKEN must differ from SETUP_TOKEN — otherwise everyone who may register can reset any password",
      });
    }
    if (value.NODE_ENV !== "production") return;
    for (const key of SECRETS_TO_CHECK) {
      if (key === "RESET_TOKEN" && value.RESET_TOKEN === "") continue;
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

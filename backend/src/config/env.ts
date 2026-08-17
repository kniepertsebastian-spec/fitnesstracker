import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET must be at least 16 characters"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET must be at least 16 characters"),
  SETUP_TOKEN: z.string().min(8, "SETUP_TOKEN must be at least 8 characters"),
  FRONTEND_ORIGIN: z.string().url().default("http://localhost:5173"),
  COOKIE_SECURE: z
    .string()
    .default("false")
    .transform((val) => val === "true"),
  CLAUDE_API_ENABLED: z
    .string()
    .default("false")
    .transform((val) => val === "true"),
  CLAUDE_API_KEY: z.string().optional().default(""),
});

// Fail fast on boot rather than crashing mysteriously on the first request that needs a var.
export const env = envSchema.parse(process.env);
export type Env = typeof env;

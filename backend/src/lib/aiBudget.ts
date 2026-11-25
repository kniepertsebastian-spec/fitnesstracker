import type { Redis } from "ioredis";
import { HttpError } from "../errors/httpErrors.js";

/**
 * Daily budgets for AI calls (photo scan, voice, recipe import — Roadmap 04), counted per user and
 * across all users. The day is the Europe/Berlin calendar day; counters expire on their own after
 * two days. A call that would overshoot either budget is not counted and is refused with 429.
 */
export interface BudgetCounter {
  incrBy(key: string, amount: number, ttlSeconds: number): Promise<number>;
  decrBy(key: string, amount: number): Promise<void>;
}

export interface AiBudgetLimits {
  perUser: number;
  global: number;
}

export interface AiBudgetResult {
  allowed: boolean;
  usedByUser: number;
  usedGlobal: number;
  remainingForUser: number;
}

const KEY_TTL_SECONDS = 2 * 24 * 60 * 60;

export function budgetDay(now: Date): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function budgetKeys(userId: string, now: Date): { user: string; global: string } {
  const day = budgetDay(now);
  return { user: `ai-budget:${day}:user:${userId}`, global: `ai-budget:${day}:global` };
}

export async function consumeAiBudget(
  counter: BudgetCounter,
  userId: string,
  limits: AiBudgetLimits,
  options: { cost?: number; now?: Date } = {},
): Promise<AiBudgetResult> {
  const cost = options.cost ?? 1;
  const keys = budgetKeys(userId, options.now ?? new Date());
  const usedByUser = await counter.incrBy(keys.user, cost, KEY_TTL_SECONDS);
  const usedGlobal = await counter.incrBy(keys.global, cost, KEY_TTL_SECONDS);
  if (usedByUser > limits.perUser || usedGlobal > limits.global) {
    // Not spent: give the units back, so a refused call doesn't use up the rest of today's budget.
    await counter.decrBy(keys.user, cost);
    await counter.decrBy(keys.global, cost);
    return { allowed: false, usedByUser: usedByUser - cost, usedGlobal: usedGlobal - cost, remainingForUser: Math.max(0, limits.perUser - (usedByUser - cost)) };
  }
  return { allowed: true, usedByUser, usedGlobal, remainingForUser: Math.max(0, limits.perUser - usedByUser) };
}

/** Throws 429 when the call would exceed today's budget; counts it otherwise. */
export async function assertAiBudget(
  counter: BudgetCounter,
  userId: string,
  limits: AiBudgetLimits,
  options: { cost?: number; now?: Date } = {},
): Promise<AiBudgetResult> {
  const result = await consumeAiBudget(counter, userId, limits, options);
  if (!result.allowed) throw new HttpError(429, "Das KI-Tageslimit ist erreicht. Morgen geht es weiter.");
  return result;
}

/**
 * Counter on Redis: shared by every backend instance and the worker, survives restarts. A Redis
 * error propagates — an AI call is refused (fails closed) rather than run without a budget.
 */
export function redisBudgetCounter(redis: Redis): BudgetCounter {
  return {
    async incrBy(key, amount, ttlSeconds) {
      const results = await redis.multi().incrby(key, amount).expire(key, ttlSeconds, "NX").exec();
      if (!results) throw new Error("Redis transaction aborted");
      const failed = results.find(([error]) => error);
      if (failed) throw failed[0];
      return Number(results[0][1]);
    },
    async decrBy(key, amount) {
      await redis.decrby(key, amount);
    },
  };
}

/** In-memory counter: tests and a backend without REDIS_URL. Expired entries are dropped on access. */
export function memoryBudgetCounter(clock: () => number = Date.now): BudgetCounter {
  const entries = new Map<string, { value: number; expiresAt: number }>();
  const live = (key: string) => {
    const entry = entries.get(key);
    if (entry && entry.expiresAt <= clock()) {
      entries.delete(key);
      return undefined;
    }
    return entry;
  };
  return {
    async incrBy(key, amount, ttlSeconds) {
      const entry = live(key) ?? { value: 0, expiresAt: clock() + ttlSeconds * 1000 };
      entry.value += amount;
      entries.set(key, entry);
      return entry.value;
    },
    async decrBy(key, amount) {
      const entry = live(key);
      if (entry) entry.value -= amount;
    },
  };
}

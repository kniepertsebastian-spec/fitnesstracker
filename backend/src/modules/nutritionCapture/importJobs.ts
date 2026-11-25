import { Queue, type ConnectionOptions } from "bullmq";

// The contract with the Kalorientracker worker (kalorientracker/worker, queue "kcal-ai"). The
// worker only fetches public pages and video metadata/subtitles (no database, no API key); the
// backend owns the AI step and the database. Results travel back as the job's return value.

export const AI_QUEUE = "kcal-ai";
export const IMPORT_JOB = { preview: "recipe-preview", extract: "recipe-extract" } as const;
export type ImportJobKind = keyof typeof IMPORT_JOB;

export interface PreviewResult {
  platform: string;
  title: string | null;
  author: string | null;
  durationSec: number | null;
}

export interface JsonLdRecipe {
  name: string | null;
  ingredients: string[];
  yield: string | null;
  instructions: string[];
}

export interface ExtractResult {
  platform: string;
  title: string | null;
  jsonLd: JsonLdRecipe | null;
  /** Page text, video description and subtitles, already trimmed by the worker. */
  text: string;
}

export type JobState =
  | { state: "pending" }
  | { state: "completed"; result: unknown }
  | { state: "failed"; error: string }
  | { state: "missing" };

export interface ImportJobs {
  enqueue(kind: ImportJobKind, importId: string, url: string): Promise<void>;
  state(kind: ImportJobKind, importId: string): Promise<JobState>;
  close(): Promise<void>;
}

// BullMQ does not allow ":" in custom job ids.
export const jobId = (kind: ImportJobKind, importId: string) => `${kind}-${importId}`;

/** Connection options from REDIS_URL; BullMQ opens (and on close ends) its own connection. */
export function redisConnectionOptions(url: string): ConnectionOptions {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    username: u.username ? decodeURIComponent(u.username) : undefined,
    password: u.password ? decodeURIComponent(u.password) : undefined,
    db: Number(u.pathname.slice(1) || 0),
    ...(u.protocol === "rediss:" ? { tls: {} } : {}),
    // Fail fast like the backend's own connection: a request must not hang on a Redis outage.
    connectTimeout: 2_000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  };
}

export function bullImportJobs(redisUrl: string): ImportJobs {
  const queue = new Queue(AI_QUEUE, { connection: redisConnectionOptions(redisUrl) });
  return {
    async enqueue(kind, importId, url) {
      await queue.add(IMPORT_JOB[kind], { importId, url }, {
        jobId: jobId(kind, importId),
        attempts: 2,
        backoff: { type: "exponential", delay: 5000 },
        // The backend reads the result within minutes; a day is plenty and keeps Redis small.
        removeOnComplete: { age: 24 * 3600 },
        removeOnFail: { age: 24 * 3600 },
      });
    },
    async state(kind, importId) {
      const job = await queue.getJob(jobId(kind, importId));
      if (!job) return { state: "missing" };
      const state = await job.getState();
      if (state === "completed") return { state: "completed", result: job.returnvalue };
      if (state === "failed") return { state: "failed", error: job.failedReason || "Unbekannter Fehler" };
      return { state: "pending" };
    },
    async close() {
      await queue.close();
    },
  };
}

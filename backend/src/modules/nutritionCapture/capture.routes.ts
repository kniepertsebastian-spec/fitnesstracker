import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { recipeImportTextSchema, recipeImportUrlSchema, voiceTextSchema, weeklyDropsQuerySchema } from "@fitnesstracker/shared";
import { env } from "../../config/env.js";
import { BadRequestError } from "../../errors/httpErrors.js";
import { assertAiBudget } from "../../lib/aiBudget.js";
import { HEAVY_RATE_LIMIT } from "../../lib/rateLimits.js";
import { dbFoodMatcher } from "./foodMatch.js";
import { geminiCaller, geminiCredentials, type GeminiCaller, type GeminiMedia } from "./gemini.js";
import { bullImportJobs, type ImportJobs } from "./importJobs.js";
import { scanNutritionLabel } from "./labelScan.service.js";
import { confirmImport, createDirectImport, createUrlImport, deleteImport, getImport, listImports, type ImportDeps } from "./recipeImport.service.js";
import { parseVoice } from "./voice.service.js";
import { listWeeklyDrops } from "./weeklyDrops.service.js";

// Kalorientracker capture (Roadmap 04): Scan & Learn, voice, recipe import, weekly drops.
// AI calls use the user's own Gemini key and count against the daily AI budget. Uploaded photos,
// audio and videos are only passed to the AI and never stored.

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const AUDIO_TYPES = new Set(["audio/webm", "audio/mp4", "audio/ogg", "audio/mpeg", "audio/wav", "audio/x-wav", "audio/aac", "audio/m4a", "audio/x-m4a"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
// Gemini takes inline media up to 20 MB per request; a phone's screen recording of a recipe clip
// fits when it is short. Photos and audio stay at the global 10 MB.
const VIDEO_MAX_BYTES = 18 * 1024 * 1024;

const idParams = z.object({ id: z.string().uuid() });
const barcodeField = z.string().regex(/^\d{6,14}$/).optional();
const shortText = z.string().trim().max(200).optional();

export interface CaptureRouteOptions {
  /** Tests inject a stub; by default the user's own Gemini key. */
  gemini?: (userId: string) => Promise<GeminiCaller>;
  /** Tests inject a fake queue; by default BullMQ on REDIS_URL, null without Redis. */
  importJobs?: ImportJobs | null;
}

const baseType = (mime: string) => mime.split(";")[0]!.trim().toLowerCase();

interface Upload {
  files: Map<string, GeminiMedia>;
  fields: Map<string, string>;
}

async function readMultipart(request: FastifyRequest, allowed: Record<string, Set<string>>, fileSize?: number): Promise<Upload> {
  if (!request.isMultipart()) throw new BadRequestError("Erwartet ein Formular mit Datei");
  const files = new Map<string, GeminiMedia>();
  const fields = new Map<string, string>();
  for await (const part of request.parts(fileSize ? { limits: { fileSize } } : undefined)) {
    if (part.type === "file") {
      const types = allowed[part.fieldname];
      const mimeType = baseType(part.mimetype);
      if (!types) {
        await part.toBuffer();
        continue;
      }
      if (!types.has(mimeType)) throw new BadRequestError(`Dateityp ${mimeType} wird nicht unterstützt`);
      files.set(part.fieldname, { mimeType, data: await part.toBuffer() });
    } else if (typeof part.value === "string") {
      fields.set(part.fieldname, part.value);
    }
  }
  return { files, fields };
}

export default async function captureRoutes(fastify: FastifyInstance, opts: CaptureRouteOptions) {
  fastify.addHook("preHandler", fastify.authenticate);

  let jobs: ImportJobs | null;
  if (opts.importJobs !== undefined) {
    jobs = opts.importJobs;
  } else {
    jobs = env.REDIS_URL ? bullImportJobs(env.REDIS_URL) : null;
    fastify.addHook("onClose", async () => jobs?.close());
  }

  const credentialsCaller = async (userId: string) => geminiCaller(await geminiCredentials(fastify.prisma, userId));
  // Key first (no budget spent on a missing key), then the budget.
  const aiFor = (userId: string, cost = 1) => async () => {
    const caller = await (opts.gemini ?? credentialsCaller)(userId);
    await assertAiBudget(fastify.aiBudgetCounter, userId, { perUser: env.AI_DAILY_BUDGET_PER_USER, global: env.AI_DAILY_BUDGET_GLOBAL }, { cost });
    return caller;
  };
  const importDeps = (userId: string, cost = 1): ImportDeps => ({ prisma: fastify.prisma, jobs, match: dbFoodMatcher(fastify.prisma, userId), ai: aiFor(userId, cost) });

  // ── Scan & Learn ──────────────────────────────────────────────────────────────────────────────
  fastify.post("/nutrition/scan/label", HEAVY_RATE_LIMIT, async (request) => {
    const userId = request.user.sub;
    const { files, fields } = await readMultipart(request, { label: IMAGE_TYPES, front: IMAGE_TYPES });
    const label = files.get("label");
    if (!label) throw new BadRequestError("Bitte ein Foto der Nährwerttabelle hochladen");
    const barcode = barcodeField.parse(fields.get("barcode") || undefined);
    const productName = shortText.parse(fields.get("productName") || undefined);
    const call = await aiFor(userId)();
    return scanNutritionLabel(call, { label, front: files.get("front") ?? null, productName, barcode });
  });

  // ── Voice ─────────────────────────────────────────────────────────────────────────────────────
  fastify.post("/nutrition/voice", HEAVY_RATE_LIMIT, async (request) => {
    const userId = request.user.sub;
    const match = dbFoodMatcher(fastify.prisma, userId);
    if (request.isMultipart()) {
      const { files } = await readMultipart(request, { audio: AUDIO_TYPES });
      const audio = files.get("audio");
      if (!audio) throw new BadRequestError("Keine Aufnahme hochgeladen");
      return parseVoice(await aiFor(userId)(), match, { audio });
    }
    const { text } = voiceTextSchema.parse(request.body);
    return parseVoice(await aiFor(userId)(), match, { text });
  });

  // ── Recipe import ─────────────────────────────────────────────────────────────────────────────
  fastify.get("/nutrition/recipe-imports", async (request) => ({ items: await listImports(fastify.prisma, request.user.sub) }));

  fastify.post("/nutrition/recipe-imports/url", HEAVY_RATE_LIMIT, async (request, reply) => {
    const { url } = recipeImportUrlSchema.parse(request.body);
    return reply.code(201).send(await createUrlImport(importDeps(request.user.sub), request.user.sub, url));
  });

  fastify.post("/nutrition/recipe-imports/text", HEAVY_RATE_LIMIT, async (request, reply) => {
    const { title, text } = recipeImportTextSchema.parse(request.body);
    return reply.code(201).send(await createDirectImport(importDeps(request.user.sub), request.user.sub, { source: "TEXT", text, title: title ?? null }));
  });

  fastify.post("/nutrition/recipe-imports/photo", HEAVY_RATE_LIMIT, async (request, reply) => {
    const { files, fields } = await readMultipart(request, { photo: IMAGE_TYPES });
    const photo = files.get("photo");
    if (!photo) throw new BadRequestError("Bitte ein Foto hochladen");
    const title = shortText.parse(fields.get("title") || undefined);
    return reply.code(201).send(await createDirectImport(importDeps(request.user.sub), request.user.sub, { source: "PHOTO", media: photo, title: title ?? null }));
  });

  // Video upload or screen recording: the fallback when a link cannot be read.
  fastify.post("/nutrition/recipe-imports/video", HEAVY_RATE_LIMIT, async (request, reply) => {
    const { files, fields } = await readMultipart(request, { video: VIDEO_TYPES }, VIDEO_MAX_BYTES);
    const video = files.get("video");
    if (!video) throw new BadRequestError("Bitte ein Video hochladen");
    const title = shortText.parse(fields.get("title") || undefined);
    // A video is a bigger request than a photo: it counts double.
    return reply.code(201).send(await createDirectImport(importDeps(request.user.sub, 2), request.user.sub, { source: "VIDEO", media: video, title: title ?? null }));
  });

  fastify.get("/nutrition/recipe-imports/:id", async (request) => {
    const { id } = idParams.parse(request.params);
    return getImport(importDeps(request.user.sub), request.user.sub, id);
  });

  fastify.post("/nutrition/recipe-imports/:id/confirm", HEAVY_RATE_LIMIT, async (request) => {
    const { id } = idParams.parse(request.params);
    return confirmImport(importDeps(request.user.sub), request.user.sub, id);
  });

  fastify.delete("/nutrition/recipe-imports/:id", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    await deleteImport(fastify.prisma, request.user.sub, id);
    return reply.code(204).send();
  });

  // ── Weekly drops ──────────────────────────────────────────────────────────────────────────────
  fastify.get("/nutrition/weekly-drops", async (request) => {
    const { maxKcal } = weeklyDropsQuerySchema.parse(request.query);
    return listWeeklyDrops(fastify.prisma, { maxKcal });
  });
}

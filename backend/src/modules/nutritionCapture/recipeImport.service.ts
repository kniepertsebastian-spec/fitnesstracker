import type { Prisma, PrismaClient, RecipeImport, RecipeImportSource } from "@prisma/client";
import { recipeDraftAiSchema, type CaptureStatus, type RecipeDraftAi } from "@fitnesstracker/shared";
import { ConflictError, NotFoundError } from "../../errors/httpErrors.js";
import type { FoodCandidate, FoodMatcher } from "./foodMatch.js";
import { parseAiAnswer, type GeminiCaller, type GeminiMedia } from "./gemini.js";
import { normalizeUnit, parseIngredientLine } from "./ingredientParser.js";
import type { ExtractResult, ImportJobs, JsonLdRecipe, PreviewResult } from "./importJobs.js";

// Recipe import (Roadmap 04, P2). A link is two steps: a free preview (platform and title, the
// worker fetches only metadata) and, once the user confirms, the extraction job. A page with a
// schema.org Recipe (JSON-LD) is read without AI; anything else (blog text, video description,
// subtitles) goes to the AI. Cookbook photos, uploaded videos/screen recordings and pasted text
// skip the worker. Every result is a draft: amounts with a status, open questions for what is
// missing, food candidates to confirm. Nutrients are calculated only when the recipe is saved,
// from the foods the user picked (raw weights, then the final weight), never taken from the AI.

export type Platform = "youtube" | "tiktok" | "instagram" | "web";

export function detectPlatform(url: string): Platform {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "web";
  }
  const is = (domain: string) => host === domain || host.endsWith(`.${domain}`);
  if (is("youtube.com") || is("youtu.be")) return "youtube";
  if (is("tiktok.com")) return "tiktok";
  if (is("instagram.com")) return "instagram";
  return "web";
}

export interface DraftIngredient {
  name: string;
  raw: string | null;
  quantity: number | null;
  unit: string | null;
  status: CaptureStatus;
  note: string | null;
  candidates: FoodCandidate[];
}

export interface RecipeDraft {
  method: "json-ld" | "ai";
  title: string | null;
  servings: { value: number | null; status: CaptureStatus };
  ingredients: DraftIngredient[];
  steps: string[];
  openQuestions: string[];
}

// A JSON-LD recipe is the author's own structured data: amounts as written are "verified".
export async function draftFromJsonLd(recipe: JsonLdRecipe, fallbackTitle: string | null, match: FoodMatcher): Promise<RecipeDraft> {
  const servingsMatch = recipe.yield ? /(\d+(?:[.,]\d+)?)/.exec(recipe.yield) : null;
  const servings = servingsMatch ? Number(servingsMatch[1]!.replace(",", ".")) : null;
  const ingredients = await Promise.all(
    recipe.ingredients.slice(0, 60).map(async (line) => {
      const parsed = parseIngredientLine(line);
      return { name: parsed.name, raw: parsed.raw, quantity: parsed.quantity, unit: parsed.unit, status: parsed.status, note: null, candidates: await match(parsed.name) };
    }),
  );
  return withQuestions({
    method: "json-ld",
    title: recipe.name ?? fallbackTitle,
    servings: servings && servings > 0 ? { value: servings, status: "verified" } : { value: null, status: "unknown" },
    ingredients,
    steps: recipe.instructions.slice(0, 40),
    openQuestions: [],
  });
}

export async function draftFromAi(ai: RecipeDraftAi, fallbackTitle: string | null, match: FoodMatcher): Promise<RecipeDraft> {
  const ingredients = await Promise.all(
    ai.ingredients.map(async (i) => {
      const unit = normalizeUnit(i.unit);
      const quantity = i.quantity === null || i.status === "unknown" ? null : i.quantity * (unit?.factor ?? 1);
      const status: CaptureStatus = quantity === null ? "unknown" : i.status === "read" ? "verified" : "estimated";
      return { name: i.name, raw: null, quantity, unit: unit?.label ?? (quantity !== null ? "Stück" : null), status, note: i.note, candidates: await match(i.name) };
    }),
  );
  const servings = ai.servings.value === null ? { value: null, status: "unknown" as const } : { value: ai.servings.value, status: (ai.servings.status === "read" ? "verified" : "estimated") as CaptureStatus };
  return withQuestions({ method: "ai", title: ai.title ?? fallbackTitle, servings, ingredients, steps: ai.steps, openQuestions: ai.openQuestions });
}

/** What the user has to answer before saving: missing amounts, unmatched foods, servings. */
export function withQuestions(draft: RecipeDraft): RecipeDraft {
  const questions = [...draft.openQuestions];
  for (const i of draft.ingredients) {
    if (i.quantity === null) questions.push(`Menge für „${i.name}“?`);
    else if (i.status === "estimated") questions.push(`Menge für „${i.name}“ ist geschätzt – stimmt ${formatAmount(i.quantity)} ${i.unit ?? ""}?`.replace(/\s+\?/, "?"));
    if (i.candidates.length === 0) questions.push(`Kein passendes Lebensmittel für „${i.name}“ gefunden.`);
  }
  if (draft.servings.value === null) questions.push("Wie viele Portionen ergibt das Rezept?");
  return { ...draft, openQuestions: [...new Set(questions)] };
}

const formatAmount = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","));

const RECIPE_RULES = `Regeln:
- Übernimm nur Zutaten und Mengen, die in der Quelle stehen oder gesagt/eingeblendet werden. Nichts ergänzen, keine Nährwerte.
- Fehlt eine Menge: quantity null, status "unknown". Ungefähre oder aus dem Bild geschätzte Mengen: status "estimated". Eindeutig angegebene: status "read".
- unit wie angegeben (g, ml, EL, TL, Stück, Dose, Prise ...). name: die Zutat ohne Menge, deutsch.
- servings: angegebene Portionen, sonst null/"unknown".
- steps: die Zubereitungsschritte kurz und deutsch. openQuestions: was unklar bleibt (deutsch).
Antworte ausschließlich mit JSON:
{"title":string|null,"servings":{"value":number|null,"status":"read"|"estimated"|"unknown"},
"ingredients":[{"name":string,"quantity":number|null,"unit":string|null,"status":"read"|"estimated"|"unknown","note":string|null}],
"steps":[string],"openQuestions":[string]}`;

export function recipePrompt(kind: "text" | "photo" | "video" | "page", title?: string | null): string {
  const what = {
    text: "dem folgenden Text (Rezept, Zutatenliste oder Video-Transkript)",
    photo: "dem Foto (Kochbuchseite oder Zutatenliste)",
    video: "dem Video (gesprochen und eingeblendet)",
    page: "dem folgenden Inhalt einer Webseite bzw. eines Social-Media-Videos (Beschreibung und Untertitel)",
  }[kind];
  return `Lies das Rezept aus ${what}.${title ? ` Titel laut Quelle: ${JSON.stringify(title)}.` : ""}\n${RECIPE_RULES}`;
}

export function toImportDto(row: RecipeImport) {
  return {
    id: row.id,
    source: row.source,
    status: row.status,
    url: row.url,
    platform: row.platform,
    title: row.title,
    draft: (row.draft as unknown as RecipeDraft | null) ?? null,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
export type RecipeImportDto = ReturnType<typeof toImportDto>;

export interface ImportDeps {
  prisma: PrismaClient;
  jobs: ImportJobs | null;
  match: FoodMatcher;
  /** Resolves the user's Gemini caller and counts the AI budget; only called when the AI is needed. */
  ai: () => Promise<GeminiCaller>;
}

const asJson = (value: unknown) => value as Prisma.InputJsonValue;
// A claimed extraction that did not finish (backend restarted mid-call) may be taken over again.
const STALE_EXTRACTING_MS = 3 * 60 * 1000;

function requireJobs(deps: ImportDeps): ImportJobs {
  if (!deps.jobs) throw new ConflictError("Link-Import ist auf diesem Server nicht verfügbar (kein Redis). Nutze Foto, Video oder Text.");
  return deps.jobs;
}

export async function createUrlImport(deps: ImportDeps, userId: string, url: string) {
  const jobs = requireJobs(deps);
  const row = await deps.prisma.recipeImport.create({ data: { userId, source: "URL", status: "PREVIEW_PENDING", url, platform: detectPlatform(url) } });
  await jobs.enqueue("preview", row.id, url);
  return toImportDto(row);
}

async function findOwn(prisma: PrismaClient, userId: string, id: string) {
  const row = await prisma.recipeImport.findUnique({ where: { id } });
  if (!row || row.userId !== userId) throw new NotFoundError("Import nicht gefunden");
  return row;
}

export async function confirmImport(deps: ImportDeps, userId: string, id: string) {
  const row = await findOwn(deps.prisma, userId, id);
  if (row.status !== "PREVIEW_READY") throw new ConflictError("Dieser Import wartet nicht auf eine Bestätigung");
  const jobs = requireJobs(deps);
  const updated = await deps.prisma.recipeImport.update({ where: { id }, data: { status: "EXTRACT_PENDING" } });
  await jobs.enqueue("extract", id, row.url!);
  return toImportDto(updated);
}

/** Reads the import and moves it on when its job has finished. Safe to call repeatedly. */
export async function getImport(deps: ImportDeps, userId: string, id: string) {
  let row = await findOwn(deps.prisma, userId, id);
  if (row.status === "PREVIEW_PENDING" && deps.jobs) row = await advancePreview(deps, row);
  if (row.status === "EXTRACTING" && Date.now() - row.updatedAt.getTime() > STALE_EXTRACTING_MS) {
    row = await deps.prisma.recipeImport.update({ where: { id }, data: { status: "EXTRACT_PENDING" } });
  }
  if (row.status === "EXTRACT_PENDING" && deps.jobs) row = await advanceExtract(deps, row);
  return toImportDto(row);
}

async function advancePreview(deps: ImportDeps, row: RecipeImport): Promise<RecipeImport> {
  const job = await deps.jobs!.state("preview", row.id);
  if (job.state === "pending") return row;
  if (job.state === "completed") {
    const result = job.result as PreviewResult;
    return deps.prisma.recipeImport.update({ where: { id: row.id }, data: { status: "PREVIEW_READY", title: result?.title ?? null, platform: result?.platform ?? row.platform } });
  }
  const error = job.state === "failed" ? `Link nicht lesbar: ${job.error.slice(0, 200)}` : "Der Vorschau-Job ist verloren gegangen. Bitte erneut versuchen.";
  return deps.prisma.recipeImport.update({ where: { id: row.id }, data: { status: "FAILED", error } });
}

async function advanceExtract(deps: ImportDeps, row: RecipeImport): Promise<RecipeImport> {
  const job = await deps.jobs!.state("extract", row.id);
  if (job.state === "pending") return row;
  if (job.state !== "completed") {
    const error = job.state === "failed" ? `Inhalt nicht lesbar: ${job.error.slice(0, 200)}` : "Der Import-Job ist verloren gegangen. Bitte erneut versuchen.";
    return deps.prisma.recipeImport.update({ where: { id: row.id }, data: { status: "FAILED", error } });
  }
  // Claim the extraction, so two polls at once don't both call the AI.
  const claimed = await deps.prisma.recipeImport.updateMany({ where: { id: row.id, status: "EXTRACT_PENDING" }, data: { status: "EXTRACTING" } });
  if (claimed.count === 0) return deps.prisma.recipeImport.findUniqueOrThrow({ where: { id: row.id } });

  const result = job.result as ExtractResult;
  const title = result?.title ?? row.title;
  try {
    let draft: RecipeDraft;
    if (result?.jsonLd && result.jsonLd.ingredients.length > 0) {
      draft = await draftFromJsonLd(result.jsonLd, title, deps.match);
    } else if (result?.text && result.text.trim().length >= 20) {
      const call = await deps.ai();
      const answer = await call({ prompt: `${recipePrompt("page", title)}\n\nInhalt:\n${result.text}`, timeoutMs: 60_000 });
      draft = await draftFromAi(parseAiAnswer(recipeDraftAiSchema, answer, "Rezept"), title, deps.match);
    } else {
      throw new ConflictError("Im Link steht kein lesbares Rezept. Lade das Video hoch, nimm den Bildschirm auf oder füge den Text ein.");
    }
    return deps.prisma.recipeImport.update({
      where: { id: row.id },
      data: { status: "READY", title: draft.title ?? title, draft: asJson(draft), sourceData: asJson({ method: draft.method, textLength: result?.text?.length ?? 0 }), error: null },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import fehlgeschlagen";
    return deps.prisma.recipeImport.update({ where: { id: row.id }, data: { status: "FAILED", error: message.slice(0, 300) } });
  }
}

/** Cookbook photo, uploaded video / screen recording or pasted text: extracted right away. */
export async function createDirectImport(
  deps: ImportDeps,
  userId: string,
  input: { source: Exclude<RecipeImportSource, "URL">; media?: GeminiMedia; text?: string; title?: string | null },
) {
  const call = await deps.ai();
  const kind = input.source === "PHOTO" ? "photo" : input.source === "VIDEO" ? "video" : "text";
  const prompt = input.text ? `${recipePrompt(kind, input.title)}\n\nText:\n${input.text}` : recipePrompt(kind, input.title);
  const answer = await call({ prompt, media: input.media ? [input.media] : [], timeoutMs: input.source === "VIDEO" ? 120_000 : 60_000 });
  const draft = await draftFromAi(parseAiAnswer(recipeDraftAiSchema, answer, "Rezept"), input.title ?? null, deps.match);
  const row = await deps.prisma.recipeImport.create({
    data: { userId, source: input.source, status: "READY", title: draft.title, draft: asJson(draft), sourceData: asJson({ method: "ai", textLength: input.text?.length ?? 0 }) },
  });
  return toImportDto(row);
}

export async function listImports(prisma: PrismaClient, userId: string) {
  const rows = await prisma.recipeImport.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20 });
  return rows.map(toImportDto);
}

export async function deleteImport(prisma: PrismaClient, userId: string, id: string) {
  await findOwn(prisma, userId, id);
  await prisma.recipeImport.delete({ where: { id } });
}

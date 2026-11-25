import { z } from "zod";

// Kalorientracker capture (Roadmap 04): what the AI is allowed to answer, and the requests of the
// scan, voice and recipe-import endpoints. The AI never fills a gap silently: every value it
// returns carries a status, and a value it cannot read or derive is `null` with status "unknown".

export const CAPTURE_STATUSES = ["verified", "estimated", "unknown"] as const;
export type CaptureStatus = (typeof CAPTURE_STATUSES)[number];

// A number from the AI. "read" = legible on the label / stated in the source; "estimated" = the
// AI derived it (e.g. from a front photo); "unknown" = not there. Coerced so that a value without
// a number is always unknown, and an "unknown" value never carries a number.
const aiStatus = z.enum(["read", "estimated", "unknown"]).catch("unknown");
export const aiNumberSchema = z
  .object({
    value: z.number().finite().nonnegative().max(100000).nullable().catch(null),
    status: aiStatus,
  })
  .transform((v) => (v.value === null || v.status === "unknown" ? { value: null, status: "unknown" as const } : v));
export type AiNumber = z.infer<typeof aiNumberSchema>;

const unknownNumber = { value: null, status: "unknown" as const };
const aiNumberOrUnknown = aiNumberSchema.optional().transform((v) => v ?? unknownNumber);
const aiText = (max: number) => z.string().trim().max(max).nullable().optional().catch(null).transform((v) => (v ? v : null));

// Nutrition table photo ("Scan & Learn"). Values per 100 g or 100 ml, as printed.
export const labelScanAiSchema = z.object({
  name: aiText(200),
  brand: aiText(120),
  basis: z.enum(["PER_100G", "PER_100ML"]).nullable().optional().catch(null).transform((v) => v ?? null),
  nutrients: z.object({
    kcal: aiNumberOrUnknown,
    proteinG: aiNumberOrUnknown,
    carbsG: aiNumberOrUnknown,
    fatG: aiNumberOrUnknown,
    fiberG: aiNumberOrUnknown,
    sugarG: aiNumberOrUnknown,
    saturatedFatG: aiNumberOrUnknown,
    saltG: aiNumberOrUnknown,
  }),
  packageSize: z
    .object({ value: z.number().finite().positive().max(100000).nullable().catch(null), unit: z.enum(["g", "ml"]).nullable().catch(null), status: aiStatus })
    .optional()
    .catch(undefined),
  servingSize: z
    .object({ value: z.number().finite().positive().max(100000).nullable().catch(null), unit: z.enum(["g", "ml"]).nullable().catch(null), label: aiText(60), status: aiStatus })
    .optional()
    .catch(undefined),
  notes: z.array(z.string().trim().max(300)).max(10).catch([]).default([]),
});
export type LabelScanAi = z.infer<typeof labelScanAiSchema>;

// Spoken meal ("200 g Skyr und eine Banane").
export const voiceAiSchema = z.object({
  transcript: z.string().trim().max(2000).catch(""),
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        quantity: z.number().finite().positive().max(100000).nullable().catch(null),
        unit: aiText(30),
        quantityStatus: aiStatus,
      }),
    )
    .max(20)
    .catch([]),
});
export type VoiceAi = z.infer<typeof voiceAiSchema>;

// A recipe the AI read from a page, a transcript, a cookbook photo or a video. No nutrients: those
// are only ever calculated from the matched foods.
export const recipeDraftAiSchema = z.object({
  title: aiText(200),
  servings: aiNumberOrUnknown,
  ingredients: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(160),
        quantity: z.number().finite().positive().max(100000).nullable().catch(null),
        unit: aiText(30),
        status: aiStatus,
        note: aiText(200),
      }),
    )
    .max(60)
    .catch([]),
  steps: z.array(z.string().trim().max(1000)).max(40).catch([]).default([]),
  openQuestions: z.array(z.string().trim().max(300)).max(20).catch([]).default([]),
});
export type RecipeDraftAi = z.infer<typeof recipeDraftAiSchema>;

export const recipeImportUrlSchema = z.object({
  url: z
    .string()
    .trim()
    .max(2000)
    .url()
    .refine((u) => /^https?:\/\//i.test(u), "Nur http- und https-Links"),
});

export const recipeImportTextSchema = z.object({
  title: z.string().trim().max(200).optional(),
  text: z.string().trim().min(20, "Bitte etwas mehr Text (Zutatenliste oder Transkript)").max(30000),
});

export const voiceTextSchema = z.object({
  text: z.string().trim().min(2).max(2000),
});

export const weeklyDropsQuerySchema = z.object({
  // Only ideas that fit into what is left of today's calories.
  maxKcal: z.coerce.number().finite().positive().max(10000).optional(),
});

import { z } from "zod";
import seed from "@/data/bank-konten.json";

export const CONTENT_CATEGORIES = [
  "Educational",
  "Informational",
  "Trending",
  "Viral Opportunity",
  "Storytelling",
  "Problem-Solution",
  "Promotional",
  "Engagement",
  "Conversion",
] as const;
export const WORKFLOW_STATUSES = ["draft", "approved", "scheduled", "published"] as const;
export const BANK_HEADERS = [
  "No",
  "Judul / Alur Konten",
  "Prompt Generate Foto",
  "Caption",
] as const;
export const SCRIPT_HEADERS = [
  "Content ID",
  "No",
  "Kategori",
  "Target Audiens",
  "Platform",
  "Format",
  "Hook 3 Detik",
  "Script",
  "Scene Breakdown",
  "Visual Direction",
  "Voice Over",
  "CTA",
  "Hashtags",
  "Thumbnail Text",
  "Durasi",
  "Status",
] as const;

export const productionSchema = z.object({
  category: z.enum(CONTENT_CATEGORIES).default("Educational"),
  audience: z.string().default(""),
  platform: z.string().default(""),
  format: z.enum(["Video", "Foto", "Carousel"]).default("Video"),
  hook: z.string().default(""),
  script: z.string().default(""),
  scenes: z.string().default(""),
  visualDirection: z.string().default(""),
  voiceOver: z.string().default(""),
  cta: z.string().default(""),
  hashtags: z.string().default(""),
  thumbnailText: z.string().default(""),
  duration: z.number().finite().nonnegative().default(0),
});
export const contentSchema = z.object({
  id: z.string().min(1),
  no: z.number().int().positive(),
  title: z.string(),
  prompt: z.string(),
  caption: z.string(),
  classification: z.enum([
    "SYSTEM_TEMPLATE",
    "PERSONAL_CONTENT",
    "SHARED_WORKSPACE",
    "UNRESOLVED_HELD",
  ]),
  production: productionSchema,
  status: z.enum(WORKFLOW_STATUSES).default("draft"),
  tags: z.array(z.string()).default([]),
  subcategory: z.string().default(""),
  legacyCells: z
    .array(
      z.object({
        column: z.number().int(),
        header: z.string(),
        value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
      }),
    )
    .default([]),
  revision: z.number().int().positive().default(1),
  history: z
    .array(z.object({ revision: z.number(), at: z.string(), snapshot: z.string() }))
    .default([]),
});
export type BankContent = z.infer<typeof contentSchema>;
export type ProductionScript = z.infer<typeof productionSchema>;

export function systemTemplates(): BankContent[] {
  return seed.map((row) =>
    contentSchema.parse({
      ...row,
      id: `system-template-${row.no}`,
      classification: "SYSTEM_TEMPLATE",
      production: {},
    }),
  );
}
export function isExactTemplate(
  row: Pick<BankContent, "no" | "title" | "prompt" | "caption">,
): boolean {
  return seed.some(
    (s) =>
      s.no === row.no &&
      s.title === row.title &&
      s.prompt === row.prompt &&
      s.caption === row.caption,
  );
}
export function contentFingerprint(row: Pick<BankContent, "title" | "prompt" | "caption">): string {
  // Canonical JSON is delimiter-safe and preserves user text exactly.
  return JSON.stringify([row.title, row.prompt, row.caption]);
}
export function forkContent(
  source: BankContent,
  no: number,
  id: string = crypto.randomUUID(),
): BankContent {
  return contentSchema.parse({
    ...source,
    no,
    id,
    classification: "PERSONAL_CONTENT",
    status: "draft",
    revision: 1,
    history: [],
  });
}
export function reviseContent(
  current: BankContent,
  patch: Partial<BankContent>,
  at = new Date().toISOString(),
): BankContent {
  if (current.classification !== "PERSONAL_CONTENT")
    throw new Error("Template sistem dan data bersama/tahan tidak dapat ditimpa.");
  if (current.status === "published")
    throw new Error("Konten sudah terbit; buat salinan baru untuk revisi.");
  return contentSchema.parse({
    ...current,
    ...patch,
    id: current.id,
    no: current.no,
    classification: current.classification,
    revision: current.revision + 1,
    history: [
      ...current.history,
      { revision: current.revision, at, snapshot: JSON.stringify({ ...current, history: [] }) },
    ],
  });
}
export function validateStatusTransition(current: BankContent, next: BankContent["status"]): void {
  if (next === current.status) return;
  if (current.classification !== "PERSONAL_CONTENT")
    throw new Error("Gunakan salinan pribadi untuk produksi.");
  if (next === "scheduled" || next === "published")
    throw new Error(
      "Status terjadwal/terbit hanya berasal dari antrean dan hasil platform, bukan perubahan manual.",
    );
  if (current.status === "published" || current.status === "scheduled")
    throw new Error("Konten yang sudah diproses tidak dapat diubah secara manual.");
}
export function filterContents(
  rows: BankContent[],
  search: string,
  category: string,
  status: string,
): BankContent[] {
  const query = search.toLocaleLowerCase("id-ID");
  return rows.filter(
    (r) =>
      (category === "all" || r.production.category === category) &&
      (status === "all" || r.status === status) &&
      [r.title, r.prompt, r.caption, r.production.script, r.subcategory, ...r.tags]
        .join("\n")
        .toLocaleLowerCase("id-ID")
        .includes(query),
  );
}
export function validateTrendEvidence(
  category: string,
  sources: { url: string; observedAt: string; evidence: string }[],
): boolean {
  return (
    category !== "Trending" ||
    sources.some(
      (s) =>
        /^https:\/\//.test(s.url) &&
        s.evidence.length > 0 &&
        Number.isFinite(Date.parse(s.observedAt)),
    )
  );
}

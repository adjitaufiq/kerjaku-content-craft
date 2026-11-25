import { contentSchema, CONTENT_CATEGORIES, forkContent, type BankContent } from "./content-bank";
import { routeTaskStructured } from "./ai-router.server";
import type { CampaignInput, ResearchSource } from "./factory-types";

const fields = [
  "title",
  "prompt",
  "caption",
  "category",
  "hook",
  "script",
  "scenes",
  "visualDirection",
  "voiceOver",
  "cta",
  "hashtags",
  "thumbnailText",
  "angle",
  "reason",
] as const;
const schema = {
  type: "object",
  additionalProperties: false,
  required: fields,
  properties: Object.fromEntries(
    fields.map((f) => [
      f,
      f === "category"
        ? { type: "string", enum: CONTENT_CATEGORIES.filter((c) => c !== "Trending") }
        : { type: "string" },
    ]),
  ),
};
type GeneratedScript = Record<(typeof fields)[number], string>;
export async function generateCampaignScript(
  input: CampaignInput,
  sources: ResearchSource[],
  ordinal: number,
  taskId: string,
  worker: string,
): Promise<BankContent> {
  const seed = input.seedContents[ordinal - 1];
  if (
    seed?.production.script.trim() &&
    seed.production.voiceOver.trim() &&
    seed.production.scenes.trim()
  )
    return forkContent(seed, 100000 + ordinal);
  const generated = await routeTaskStructured<GeneratedScript>(
    {
      capability: "SCRIPT_GENERATION",
      name: "factory_script",
      schema,
      instructions:
        "Anda penulis KERJAKU. Buat naskah Bahasa Indonesia lengkap dan praktis, bukan placeholder. Gunakan fakta yang tersedia; jangan mengarang klaim statistik, produk atau popularitas. Sumber diskusi teknologi bukan bukti tren sosial. Bedakan prediksi Viral Opportunity dan tren terukur. Hook 3 detik, VO sesuai durasi, scene bernomor, arahan visual, CTA dan caption. Buat angle berbeda untuk ordinal konten. Prompt gambar harus mencakup teks tipografi yang akurat. Jangan menggunakan Trending tanpa bukti platform aktual.",
      prompt: JSON.stringify({
        campaign: input,
        sources,
        contentOrdinal: ordinal,
        totalContents: input.count,
      }),
    },
    taskId,
    worker,
  );
  const s = generated.result;
  if (!s.script.trim() || !s.voiceOver.trim() || !s.scenes.trim())
    throw new Error("Naskah produksi tidak lengkap.");
  return contentSchema.parse({
    id: crypto.randomUUID(),
    no: 100000 + ordinal,
    title: s.title,
    prompt: s.prompt,
    caption: s.caption,
    classification: "PERSONAL_CONTENT",
    tags: [s.angle],
    subcategory: s.reason,
    production: {
      category: s.category,
      audience: input.audience,
      platform: input.platforms.join(", "),
      format: "Video",
      hook: s.hook,
      script: s.script,
      scenes: s.scenes,
      visualDirection: s.visualDirection,
      voiceOver: s.voiceOver,
      cta: s.cta,
      hashtags: s.hashtags,
      thumbnailText: s.thumbnailText,
      duration: input.duration,
    },
  });
}

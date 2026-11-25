import { contentSchema, CONTENT_CATEGORIES } from "./content-bank";
import type { CampaignInput, ResearchSource } from "./factory-types";
import { prepareProductionContent, sceneSchema, productionFormats } from "./factory-plan";

const fields = [
  "title",
  "prompt",
  "caption",
  "category",
  "hook",
  "script",
  "visualDirection",
  "voiceOver",
  "cta",
  "hashtags",
  "thumbnailText",
  "angle",
  "reason",
] as const;
export type GeneratedScript = Record<(typeof fields)[number], string> & {
  scenes: { heading: string; narration: string; visual: string }[];
};
export function campaignScriptRequest(
  input: CampaignInput,
  sources: ResearchSource[],
  ordinal: number,
  feedback: unknown = null,
) {
  const minimumScenes = productionFormats(input, ordinal).includes("Carousel") ? input.slides : 3;
  return {
    capability: "SCRIPT_GENERATION" as const,
    name: "factory_script",
    schema: {
      type: "object",
      additionalProperties: false,
      required: [...fields, "scenes"],
      properties: {
        ...Object.fromEntries(
          fields.map((f) => [
            f,
            f === "category"
              ? { type: "string", enum: CONTENT_CATEGORIES.filter((c) => c !== "Trending") }
              : { type: "string" },
          ]),
        ),
        scenes: {
          type: "array",
          minItems: minimumScenes,
          maxItems: 10,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["heading", "narration", "visual"],
            properties: {
              heading: { type: "string" },
              narration: { type: "string" },
              visual: { type: "string" },
            },
          },
        },
      },
    },
    instructions:
      "Anda penulis KERJAKU. Buat naskah Bahasa Indonesia praktis dari sumber tersedia, bukan placeholder. Jangan mengarang statistik, produk, popularitas, tren, atau performa. Sumber diskusi bukan bukti tren sosial. Buat ide, strategi, hook 3 detik, caption, CTA, hashtags dan scene terstruktur. Setiap scene memiliki heading pendek, narration yang jika digabung menjadi voiceOver UTUH, dan visual spesifik berbeda mengikuti narasi. Siapkan alur hook, materi, CTA yang bisa dipakai untuk poster, carousel dan video. Jangan menyebut angka waktu atau kesuksesan tanpa bukti. VO sesuai durasi target. Rekomendasi dari metrik adalah hipotesis, bukan jaminan pertumbuhan.",
    prompt: JSON.stringify({ campaign: input, sources, contentOrdinal: ordinal, feedback }),
  };
}
export function campaignScriptDocument(
  input: CampaignInput,
  script: GeneratedScript,
  ordinal: number,
  id: string,
) {
  const scenes = script.scenes.map((scene) => sceneSchema.parse(scene));
  if (!script.script.trim() || scenes.length < 3) throw new Error("Naskah produksi tidak lengkap.");
  return prepareProductionContent(
    contentSchema.parse({
      id,
      no: 100000 + ordinal,
      title: script.title,
      prompt: script.prompt,
      caption: script.caption,
      classification: "PERSONAL_CONTENT",
      tags: [script.angle],
      subcategory: script.reason,
      production: {
        category: script.category,
        audience: input.audience,
        platform: input.platforms.join(", "),
        format:
          input.seedContents[ordinal - 1]?.production.format ??
          (input.formats.includes("Video") ? "Video" : input.formats[0]),
        hook: script.hook,
        script: script.script,
        scenes: JSON.stringify(scenes),
        visualDirection: script.visualDirection,
        voiceOver: scenes.map((s) => s.narration).join(" "),
        cta: script.cta,
        hashtags: script.hashtags,
        thumbnailText: script.thumbnailText,
        duration: input.duration,
      },
    }),
  );
}

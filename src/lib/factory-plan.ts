import { z } from "zod";
import { contentSchema, type BankContent } from "./content-bank";
import type { CampaignInput } from "./factory-types";

export const sceneSchema = z.object({
  heading: z.string().min(1).max(120),
  narration: z.string().min(1).max(1200),
  visual: z.string().min(1).max(1200),
});
export type FactoryScene = z.infer<typeof sceneSchema>;
/** One narration contract for script, storyboard, TTS and renderer; originals remain untouched. */
export function prepareProductionContent(content: BankContent): BankContent {
  if (!content.title.trim() || !content.caption.trim() || !content.production.script.trim())
    throw new Error("Judul, caption dan naskah produksi wajib terisi.");
  const scenes = readScenes(content);
  const voiceOver = scenes.map((scene) => scene.narration.trim()).join(" ");
  return contentSchema.parse({
    ...content,
    production: { ...content.production, scenes: JSON.stringify(scenes), voiceOver },
  });
}
export function productionFormats(config: CampaignInput, ordinal: number) {
  const seed = config.seedContents[ordinal - 1];
  return seed ? [seed.production.format] : config.formats;
}
export function readScenes(content: BankContent): FactoryScene[] {
  try {
    return z.array(sceneSchema).min(2).max(20).parse(JSON.parse(content.production.scenes));
  } catch {
    // Existing storyboards remain usable; preserve their narration without inventing new facts.
    const sections = content.production.script
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return [
      {
        heading: content.production.hook || content.title,
        narration: sections[0] || content.title,
        visual: content.prompt,
      },
      ...sections.slice(1, 9).map((text) => ({
        heading: text.split(/[.!?]/)[0]?.slice(0, 100) || content.title,
        narration: text,
        visual: content.production.visualDirection || content.prompt,
      })),
      {
        heading: content.production.cta || "Langkah berikutnya",
        narration: content.production.cta || content.caption,
        visual: content.production.visualDirection || content.prompt,
      },
    ];
  }
}
export function nativeFiles(stage: string, config: CampaignInput, ordinal: number) {
  const formats = productionFormats(config, ordinal);
  const file = (
    filename: string,
    kind: "image" | "voice" | "video" | "subtitle" | "metadata",
    mime: string,
  ) => ({ filename, kind, mime });
  if (stage === "design")
    return [
      ...(formats.includes("Foto")
        ? [file("poster.png", "image", "image/png"), file("poster.jpg", "image", "image/jpeg")]
        : []),
      ...(formats.includes("Carousel")
        ? Array.from({ length: config.slides }, (_, i) =>
            file(`carousel-${String(i + 1).padStart(2, "0")}.png`, "image", "image/png"),
          )
        : []),
    ];
  if (stage === "voice")
    return [
      file("voice.mp3", "voice", "audio/mpeg"),
      file("subtitles.srt", "subtitle", "application/x-subrip"),
      file("subtitles.vtt", "subtitle", "text/vtt"),
      file("subtitles.ass", "subtitle", "text/x-ssa"),
      file("alignment.json", "metadata", "application/json"),
    ];
  if (stage === "render") return [file("video.mp4", "video", "video/mp4")];
  return [];
}

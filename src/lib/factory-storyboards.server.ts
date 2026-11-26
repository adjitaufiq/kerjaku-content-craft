/** Reuse Cliper's engines without mounting or changing its interface. */
import { generateCarouselPromptPackage } from "./carousel-prompt.server";
import { generatePhotoToVideoPackage } from "./photo-to-video.server";
import {
  generateAtmVersion,
  generateHookMatrix,
  type ViralDnaResult,
  type BrandKnowledgeInput,
} from "./cliper-intelligence.server";
import { contentSchema, type BankContent } from "./content-bank";
import { productionFormats, prepareProductionContent } from "./factory-plan";
import type { CampaignInput, ResearchSource } from "./factory-types";
import type { CarouselPromptPackage } from "./carousel-prompt.types";
import { factoryClient } from "./factory-db";
import { z } from "zod";

const dnaSchema = z.object({
  hook: z.string(),
  hook_type: z.string(),
  hook_reason: z.string(),
  pattern_interrupt: z.string(),
  psychological_trigger: z.string(),
  curiosity_gap: z.string(),
  power_words: z.array(z.string()),
  structure_type: z.string(),
  retention_factor: z.string(),
  engagement_factor: z.string(),
  save_trigger: z.string(),
  share_trigger: z.string(),
  comment_trigger: z.string(),
  hook_category: z.string(),
  structure_category: z.string(),
  trigger_category: z.string(),
  evidence: z.array(
    z.object({
      source_type: z.enum(["transcript", "on_screen_text", "visual"]),
      timestamp: z.string(),
      quote: z.string(),
    }),
  ),
  story_beats: z.array(
    z.object({
      order: z.number(),
      role: z.string(),
      description: z.string(),
      evidence: z.array(
        z.object({
          source_type: z.enum(["transcript", "on_screen_text", "visual"]),
          timestamp: z.string(),
          quote: z.string(),
        }),
      ),
    }),
  ),
});
export async function runFactoryStoryboards(
  content: BankContent,
  input: CampaignInput,
  sources: ResearchSource[],
  ordinal: number,
  execution: { taskId: string; worker: string },
): Promise<BankContent> {
  const formats = productionFormats(input, ordinal);
  if (!formats.some((format) => format === "Carousel" || format === "Video")) return content;
  let dna: ViralDnaResult | null = null;
  let atm: unknown = { adaptation: content.production.script, source_mapping: sources };
  let concept = {
    hook: content.production.hook,
    hook_type: "original",
    rationale: content.subcategory,
    psychological_trigger: "Memahami masalah dan solusi praktis",
    curiosity_gap: "Bagaimana menerapkan solusi?",
    pattern_interrupt: "Perbandingan kondisi sebelum dan sesudah",
    power_words: ["praktis"],
  };
  const brand: BrandKnowledgeInput = {
    profile: {
      brand_name: content.production.automation?.brand || "KERJAKU",
      positioning: "",
      audience: input.audience,
      tone_of_voice: "Bahasa Indonesia praktis",
      mission: "",
      version: "factory",
    },
    products: [],
    rules: [],
    power_words: [],
  };
  if (input.referenceSourceId) {
    // The worker credential alone does not grant access to another owner's reference.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: task } = await factoryClient(supabaseAdmin)
      .from("craft_tasks")
      .select("user_id,lease_until")
      .eq("id", execution.taskId)
      .eq("state", "running")
      .eq("lease_owner", execution.worker)
      .single();
    if (!task?.lease_until || Date.parse(task.lease_until) <= Date.now())
      throw new Error("LEASE_LOST");
    const { data: reference, error } = await supabaseAdmin
      .from("viral_intelligence")
      .select("*")
      .eq("source_id", input.referenceSourceId)
      .eq("user_id", task.user_id)
      .maybeSingle();
    if (error || !reference)
      throw new Error("Referensi DNA tidak tersedia untuk pemilik campaign.");
    dna = dnaSchema.parse(reference);
    const adapted = await generateAtmVersion(
      { mode: "creative", angle: input.command, dna, brand },
      execution,
    );
    atm = adapted.result;
    const hooks = await generateHookMatrix(
      { mode: "creative", angle: input.command, dna, atm: adapted.result, brand },
      execution,
    );
    const selected = hooks.result.candidates[ordinal % hooks.result.candidates.length];
    if (!selected) throw new Error("Hook matrix kosong.");
    concept = { ...selected, pattern_interrupt: dna.pattern_interrupt };
  }
  const generated = await generateCarouselPromptPackage(
    {
      slideCount: input.slides,
      visualStyle: content.production.visualDirection,
      textLevel: "singkat",
      concept,
      atm: { angle: input.command, adaptation: atm, source_mapping: sources, atm_mode: "creative" },
      dna,
      sourceReport: {
        sources,
        script: content.production.script,
        note: dna
          ? "DNA sumber tersimpan; bukan bukti tren baru"
          : "Konsep orisinal berbasis riset; bukan analisis video viral",
      },
      brand,
    },
    execution,
  );
  const carousel: CarouselPromptPackage = {
    ...generated.result,
    source_id: input.referenceSourceId || content.id,
    selected_concept_id: content.id,
    analysis_version: "factory",
    ATM_version: "factory",
    slide_count: input.slides,
    visual_style: content.production.visualDirection,
    aspect_ratio: "4:5",
    resolution: "1080x1350",
  };
  if (
    carousel.slides.length !== input.slides ||
    carousel.slides.some(
      (s, i) => s.slide_number !== i + 1 || !s.image_prompt.trim() || !s.headline.trim(),
    )
  )
    throw new Error("Storyboard carousel tidak lengkap/berurutan.");
  const video = formats.includes("Video")
    ? await generatePhotoToVideoPackage(
        { defaultDuration: 6, carousel, slides: carousel.slides, concept },
        execution,
      )
    : null;
  if (
    video &&
    (video.result.scenes.length !== carousel.slides.length ||
      video.result.scenes.some((s, i) => s.source_carousel_slide !== i + 1))
  )
    throw new Error("Storyboard video tidak cocok dengan carousel.");
  const scenes = carousel.slides.map((slide, index) => {
    const motion = video?.result.scenes[index];
    return {
      heading: slide.headline,
      narration: [slide.headline, slide.supporting_text].filter(Boolean).join(". "),
      visual: slide.image_prompt,
      image_prompt: slide.image_prompt,
      narrative_function: slide.narrative_function,
      layout_direction: slide.layout_direction,
      ...(motion
        ? {
            camera_motion: motion.camera_motion,
            primary_subject_motion: motion.primary_subject_motion,
            environment_motion: motion.environment_motion,
            duration_seconds: motion.duration_seconds,
            photo_to_video_prompt: motion.photo_to_video_prompt,
          }
        : {}),
    };
  });
  return prepareProductionContent(
    contentSchema.parse({
      ...content,
      production: {
        ...content.production,
        hook: carousel.selected_hook,
        cta: carousel.CTA,
        scenes: JSON.stringify(scenes),
        carouselPackage: carousel,
        ...(video
          ? {
              videoPackage: {
                ...video.result,
                version_id: content.id,
                source_id: carousel.source_id,
                aspect_ratio: "9:16",
                resolution: "1080x1920",
              },
            }
          : {}),
        automation: {
          ...content.production.automation,
          voice:
            content.production.automation?.voice ||
            (input.voice.persona === "male" ? "id-ID-ArdiNeural" : "id-ID-GadisNeural"),
          characterLock: carousel.character_lock,
        },
      },
    }),
  );
}

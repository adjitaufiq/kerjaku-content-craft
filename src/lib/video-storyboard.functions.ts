import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import type { AtmMode } from "@/lib/cliper-intelligence.functions";
import type { CarouselSlide, ContentInfo, VisualPrompt } from "@/lib/content-production.server";
import type {
  SceneDuration,
  StoryboardScene,
  VideoConcept,
  VideoPackage,
} from "@/lib/video-storyboard.server";

export type StoryboardRecord = {
  id: string;
  version_id: string;
  atm_mode: AtmMode;
  video_concept: VideoConcept;
  scenes: StoryboardScene[];
  video_package: VideoPackage;
  scene_count: number;
  total_duration: number;
  model: string;
  created_at: string;
  updated_at: string;
};

export type StoryboardWorkspace = {
  version: { id: string; angle: string; atm_mode: AtmMode; status: string } | null;
  hasProduction: boolean;
  storyboard: StoryboardRecord | null;
};

export const getVideoStoryboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { versionId: string }) => input)
  .handler(async ({ data, context }): Promise<StoryboardWorkspace> => {
    const [version, production, storyboard] = await Promise.all([
      context.supabase
        .from("kerjaku_versions")
        .select("id,angle,atm_mode,status")
        .eq("id", data.versionId)
        .maybeSingle(),
      context.supabase
        .from("content_production_results")
        .select("id")
        .eq("version_id", data.versionId)
        .maybeSingle(),
      context.supabase
        .from("video_storyboards")
        .select("*")
        .eq("version_id", data.versionId)
        .maybeSingle(),
    ]);
    const error = version.error ?? production.error ?? storyboard.error;
    if (error) throw new Error(error.message);
    return {
      version: (version.data ?? null) as StoryboardWorkspace["version"],
      hasProduction: Boolean(production.data),
      storyboard: (storyboard.data ?? null) as StoryboardRecord | null,
    };
  });

export const runVideoStoryboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { versionId: string }) => input)
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { data: version, error: versionError } = await context.supabase
      .from("kerjaku_versions")
      .select("id,angle,atm_mode,status")
      .eq("id", data.versionId)
      .maybeSingle();
    if (versionError) throw new Error(versionError.message);
    if (!version) throw new Error("Versi KERJAKU tidak ditemukan.");
    if (version.status !== "approved") {
      throw new Error("Versi KERJAKU harus disetujui lebih dahulu sebelum membuat storyboard video.");
    }

    const [production, profile, products, rules, words] = await Promise.all([
      context.supabase
        .from("content_production_results")
        .select("content_info,carousel_structure,visual_prompts")
        .eq("version_id", version.id)
        .maybeSingle(),
      context.supabase.from("brand_profile").select("*").maybeSingle(),
      context.supabase.from("brand_products").select("name,description,benefit").order("created_at"),
      context.supabase.from("brand_rules").select("rule,rule_type").order("created_at"),
      context.supabase.from("brand_power_words").select("word,context").order("created_at"),
    ]);
    const queryError = production.error ?? profile.error ?? products.error ?? rules.error ?? words.error;
    if (queryError) throw new Error(queryError.message);
    if (!production.data) {
      throw new Error("Aset Content Production belum tersedia. Buat aset produksi konten terlebih dahulu.");
    }
    if (!profile.data?.positioning || !profile.data.audience || !profile.data.tone_of_voice) {
      throw new Error("Lengkapi positioning, audience, dan tone of voice di Brand Center terlebih dahulu.");
    }

    const { generateVideoStoryboard } = await import("@/lib/video-storyboard.server");
    const generated = await generateVideoStoryboard({
      mode: version.atm_mode,
      angle: version.angle,
      contentInfo: production.data.content_info as unknown as ContentInfo,
      carousel: production.data.carousel_structure as unknown as CarouselSlide[],
      visualPrompts: production.data.visual_prompts as unknown as VisualPrompt[],
      brand: {
        profile: {
          brand_name: profile.data.brand_name,
          positioning: profile.data.positioning,
          audience: profile.data.audience,
          tone_of_voice: profile.data.tone_of_voice,
          mission: profile.data.mission,
          version: profile.data.version,
        },
        products: products.data ?? [],
        rules: rules.data ?? [],
        power_words: words.data ?? [],
      },
    });

    const { error: saveError } = await context.supabase.from("video_storyboards").upsert(
      {
        version_id: version.id,
        user_id: context.userId,
        atm_mode: version.atm_mode,
        video_concept: generated.result.video_concept as unknown as Json,
        scenes: generated.result.scenes as unknown as Json,
        video_package: generated.result.video_package as unknown as Json,
        scene_count: generated.result.scenes.length,
        total_duration: generated.result.video_package.total_duration,
        model: generated.model,
      },
      { onConflict: "version_id" },
    );
    if (saveError) throw new Error(saveError.message);
    return { ok: true };
  });

export const updateStoryboardScenes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { versionId: string; scenes: StoryboardScene[] }) => input)
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const allowed: number[] = [4, 6, 8, 10];
    const scenes = data.scenes.map((scene, index) => ({
      ...scene,
      scene_number: index + 1,
      duration_seconds: (allowed.includes(Number(scene.duration_seconds))
        ? Number(scene.duration_seconds)
        : 4) as SceneDuration,
    }));
    const total = scenes.reduce((sum, scene) => sum + scene.duration_seconds, 0);

    const { data: current, error: readError } = await context.supabase
      .from("video_storyboards")
      .select("video_package")
      .eq("version_id", data.versionId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!current) throw new Error("Storyboard belum tersedia.");

    const pkg = {
      ...((current.video_package ?? {}) as Record<string, unknown>),
      scene_order: scenes.map((scene) => scene.scene_number),
      total_duration: total,
    };

    const { error } = await context.supabase
      .from("video_storyboards")
      .update({
        scenes: scenes as unknown as Json,
        video_package: pkg as unknown as Json,
        scene_count: scenes.length,
        total_duration: total,
      })
      .eq("version_id", data.versionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

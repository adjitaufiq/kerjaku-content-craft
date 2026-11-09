import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import type { CarouselPromptPackage, CarouselPromptSlide } from "@/lib/carousel-prompt.types";
import {
  VIDEO_DURATIONS,
  VIDEO_NEGATIVE_PROMPT,
  validatePhotoToVideoPackage,
  type PhotoToVideoPackage,
  type PhotoToVideoRecord,
  type PhotoToVideoScene,
  type PhotoToVideoStatus,
  type VideoDuration,
} from "@/lib/photo-to-video.types";

export const CAROUSEL_REQUIRED_MESSAGE =
  "Buat dan setujui Prompt Carousel terlebih dahulu sebelum membuat Photo-to-Video Prompt.";

export type PhotoToVideoState = {
  status: PhotoToVideoStatus | "CAROUSEL_PROMPT_REQUIRED";
  message: string;
  record: PhotoToVideoRecord | null;
};

function toRecord(row: Record<string, unknown>): PhotoToVideoRecord {
  return {
    id: row["id"] as string,
    version_id: row["version_id"] as string,
    source_id: row["source_id"] as string,
    status: row["status"] as PhotoToVideoStatus,
    default_duration: row["default_duration"] as VideoDuration,
    scene_count: row["scene_count"] as number,
    package: row["package"] as unknown as PhotoToVideoPackage,
    scenes: (row["scenes"] ?? []) as unknown as PhotoToVideoScene[],
    validation: row["validation"] as PhotoToVideoRecord["validation"],
    model: row["model"] as string,
    approved_at: (row["approved_at"] ?? null) as string | null,
    updated_at: row["updated_at"] as string,
  };
}

type CarouselSource = {
  source_id: string;
  package: CarouselPromptPackage;
  slides: CarouselPromptSlide[];
};

async function loadCarousel(
  supabase: { from: (table: string) => any },
  versionId: string,
): Promise<CarouselSource | null> {
  const { data, error } = await supabase
    .from("carousel_prompt_packages")
    .select("source_id,status,package,slides")
    .eq("version_id", versionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const slides = (data.slides ?? []) as CarouselPromptSlide[];
  if (!slides.length) return null;
  return { source_id: data.source_id as string, package: data.package as CarouselPromptPackage, slides };
}

export const getPhotoToVideo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { versionId: string }) => input)
  .handler(async ({ data, context }): Promise<PhotoToVideoState> => {
    const carousel = await loadCarousel(context.supabase as never, data.versionId);
    if (!carousel) {
      return { status: "CAROUSEL_PROMPT_REQUIRED", message: CAROUSEL_REQUIRED_MESSAGE, record: null };
    }
    const { data: row, error } = await context.supabase
      .from("photo_to_video_packages")
      .select("*")
      .eq("version_id", data.versionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { status: "NOT_GENERATED", message: "", record: null };
    const record = toRecord(row as unknown as Record<string, unknown>);
    return { status: record.status, message: "", record };
  });

export const generatePhotoToVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { versionId: string; defaultDuration: VideoDuration; canvaNotes?: Record<number, string> }) => ({
      ...input,
      canvaNotes: Object.fromEntries(
        Object.entries(input.canvaNotes ?? {}).map(([k, v]) => [Number(k), String(v ?? "").slice(0, 2000)]),
      ),
    }),
  )
  .handler(async ({ data, context }): Promise<PhotoToVideoState> => {
    const carousel = await loadCarousel(context.supabase as never, data.versionId);
    if (!carousel) {
      return { status: "CAROUSEL_PROMPT_REQUIRED", message: CAROUSEL_REQUIRED_MESSAGE, record: null };
    }

    const { data: existing } = await context.supabase
      .from("photo_to_video_packages")
      .select("status")
      .eq("version_id", data.versionId)
      .maybeSingle();
    const existingStatus = (existing as { status?: string } | null)?.status;
    if (existingStatus === "GENERATING")
      throw new Error("Photo-to-Video Prompt sedang dibuat. Tunggu proses berjalan selesai.");
    if (existingStatus === "APPROVED_VIDEO_PROMPT")
      throw new Error("Photo-to-Video Prompt sudah disetujui dan terkunci.");

    const base = {
      version_id: data.versionId,
      source_id: carousel.source_id,
      user_id: context.userId,
      default_duration: data.defaultDuration,
    };

    await context.supabase.from("photo_to_video_packages").upsert(
      {
        ...base,
        status: "GENERATING" satisfies PhotoToVideoStatus,
        scene_count: 0,
        package: {} as unknown as Json,
        scenes: [] as unknown as Json,
        validation: { passed: false, issues: [], checked_at: new Date().toISOString() } as unknown as Json,
        model: "",
      },
      { onConflict: "version_id" },
    );

    try {
      const { data: version } = await context.supabase
        .from("kerjaku_versions")
        .select("selected_hook")
        .eq("id", data.versionId)
        .maybeSingle();

      const { generatePhotoToVideoPackage } = await import("@/lib/photo-to-video.server");
      const generated = await generatePhotoToVideoPackage({
        defaultDuration: data.defaultDuration,
        carousel: carousel.package,
        slides: carousel.slides,
        concept: (version as { selected_hook?: unknown } | null)?.selected_hook ?? null,
        canvaNotes: data.canvaNotes,
      });

      const scenes: PhotoToVideoScene[] = generated.result.scenes.map((scene, index) => ({
        ...scene,
        scene_number: index + 1,
        source_carousel_slide: carousel.slides[index]?.slide_number ?? index + 1,
        duration_seconds: VIDEO_DURATIONS.includes(scene.duration_seconds)
          ? scene.duration_seconds
          : data.defaultDuration,
        video_negative_prompt: VIDEO_NEGATIVE_PROMPT,
        photo_to_video_prompt: [
          "Animate the existing generated image naturally into a cinematic realistic vertical video. Do not create or redesign the image.",
          "",
          `Duration: ${VIDEO_DURATIONS.includes(scene.duration_seconds) ? scene.duration_seconds : data.defaultDuration} seconds. Vertical 9:16 video.`,
          "",
          "Camera movement:",
          scene.camera_motion,
          "",
          "Subject movement:",
          scene.primary_subject_motion,
          "",
          "Environment movement:",
          scene.environment_motion,
          "",
          "VO synchronization:",
          scene.vo_synchronization,
          "",
          "Ending frame:",
          scene.ending_frame,
          "",
          "Visual consistency:",
          "Preserve the same character identity, face, clothing, environment, objects, color palette, lighting style, and same composition. Keep all important visual elements visible. Maintain realistic physics and natural motion.",
          "",
          "Motion style:",
          "Premium editorial video, modern brand storytelling, professional social media content, cinematic realistic movement, subtle to medium intensity, realism over effects, in a single continuous shot with no scene cuts.",
          "",
          "Negative prompt:",
          VIDEO_NEGATIVE_PROMPT,
        ].join("\n"),
      }));

      const pkg: PhotoToVideoPackage = {
        ...generated.result,
        selected_hook: generated.result.selected_hook?.trim() || carousel.package.selected_hook,
        main_problem: generated.result.main_problem?.trim() || carousel.package.main_problem,
        main_solution: generated.result.main_solution?.trim() || carousel.package.main_solution,
        payoff: generated.result.payoff?.trim() || carousel.package.payoff,
        CTA: generated.result.CTA?.trim() || carousel.package.CTA,
        primary_engagement_objective:
          generated.result.primary_engagement_objective?.trim() ||
          carousel.package.primary_engagement_objective,
        character_lock: generated.result.character_lock?.trim() || carousel.package.character_lock,
        visual_style: generated.result.visual_style?.trim() || carousel.package.visual_style,
        scenes,
        version_id: data.versionId,
        source_id: carousel.source_id,
        aspect_ratio: "9:16",
        resolution: "1080x1920",
      };

      const validation = validatePhotoToVideoPackage(pkg, {
        hook: carousel.package.selected_hook,
        main_problem: carousel.package.main_problem,
        main_solution: carousel.package.main_solution,
        payoff: carousel.package.payoff,
        CTA: carousel.package.CTA,
        slide_count: carousel.slides.length,
      });

      const { data: saved, error: saveError } = await context.supabase
        .from("photo_to_video_packages")
        .upsert(
          {
            ...base,
            status: (validation.passed ? "READY_FOR_REVIEW" : "NEEDS_REVISION") satisfies PhotoToVideoStatus,
            scene_count: scenes.length,
            package: pkg as unknown as Json,
            scenes: scenes as unknown as Json,
            validation: validation as unknown as Json,
            model: generated.model,
            approved_at: null,
          },
          { onConflict: "version_id" },
        )
        .select("*")
        .maybeSingle();
      if (saveError) throw new Error(saveError.message);

      const record = toRecord(saved as unknown as Record<string, unknown>);
      return { status: record.status, message: "", record };
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "Gagal membuat Photo-to-Video Prompt.";
      await context.supabase
        .from("photo_to_video_packages")
        .update({
          status: "GENERATION_FAILED",
          validation: {
            passed: false,
            issues: [{ failed_rule: "GENERATION_FAILED", affected_scene: null, reason }],
            checked_at: new Date().toISOString(),
          } as unknown as Json,
        })
        .eq("version_id", data.versionId);
      throw error instanceof Error ? error : new Error("Gagal membuat Photo-to-Video Prompt.");
    }
  });

export const savePhotoToVideoDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { versionId: string; scenes: PhotoToVideoScene[] }) => input)
  .handler(async ({ data, context }): Promise<PhotoToVideoState> => {
    const carousel = await loadCarousel(context.supabase as never, data.versionId);
    if (!carousel) {
      return { status: "CAROUSEL_PROMPT_REQUIRED", message: CAROUSEL_REQUIRED_MESSAGE, record: null };
    }
    const { data: row, error } = await context.supabase
      .from("photo_to_video_packages")
      .select("*")
      .eq("version_id", data.versionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Belum ada paket video untuk disimpan.");
    const current = toRecord(row as unknown as Record<string, unknown>);
    if (current.status === "APPROVED_VIDEO_PROMPT")
      throw new Error("Photo-to-Video Prompt sudah disetujui dan terkunci.");

    const scenes = data.scenes.map((scene, index) => ({
      ...scene,
      scene_number: index + 1,
      video_negative_prompt: VIDEO_NEGATIVE_PROMPT,
    }));
    const pkg: PhotoToVideoPackage = { ...current.package, scenes };
    const validation = validatePhotoToVideoPackage(pkg, {
      hook: carousel.package.selected_hook,
      main_problem: carousel.package.main_problem,
      main_solution: carousel.package.main_solution,
      payoff: carousel.package.payoff,
      CTA: carousel.package.CTA,
      slide_count: carousel.slides.length,
    });

    const { data: saved, error: saveError } = await context.supabase
      .from("photo_to_video_packages")
      .update({
        status: (validation.passed ? "DRAFT" : "NEEDS_REVISION") satisfies PhotoToVideoStatus,
        scene_count: scenes.length,
        package: pkg as unknown as Json,
        scenes: scenes as unknown as Json,
        validation: validation as unknown as Json,
      })
      .eq("version_id", data.versionId)
      .select("*")
      .maybeSingle();
    if (saveError) throw new Error(saveError.message);
    const record = toRecord(saved as unknown as Record<string, unknown>);
    return { status: record.status, message: "", record };
  });

export const approvePhotoToVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { versionId: string }) => input)
  .handler(async ({ data, context }): Promise<PhotoToVideoState> => {
    const { data: row, error } = await context.supabase
      .from("photo_to_video_packages")
      .select("*")
      .eq("version_id", data.versionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Belum ada paket video untuk disetujui.");
    const current = toRecord(row as unknown as Record<string, unknown>);
    if (!current.validation?.passed)
      throw new Error("Perbaiki seluruh catatan validator sebelum menyetujui Photo-to-Video Prompt.");

    const { data: saved, error: saveError } = await context.supabase
      .from("photo_to_video_packages")
      .update({
        status: "APPROVED_VIDEO_PROMPT" satisfies PhotoToVideoStatus,
        approved_at: new Date().toISOString(),
      })
      .eq("version_id", data.versionId)
      .select("*")
      .maybeSingle();
    if (saveError) throw new Error(saveError.message);
    const record = toRecord(saved as unknown as Record<string, unknown>);
    return { status: record.status, message: "", record };
  });

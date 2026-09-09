import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { RemixCaption, RemixCta, RemixSlide } from "@/lib/content-remix.server";

export type ContentRemixRow = {
  id: string;
  reference_id: string;
  content_angle: string;
  angle_rationale: string;
  structure_type: string;
  content_type: "carousel" | "photo_to_video" | "video_content";
  slides: RemixSlide[];
  captions: RemixCaption[];
  hashtags: string[];
  ctas: RemixCta[];
  quality_check: {
    pattern_interrupt: string;
    psychological_trigger: string;
    curiosity_gap: string;
    power_word: string;
  };
  model: string;
  created_at: string;
  updated_at: string;
};

export const listContentRemixes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ContentRemixRow[]> => {
    const { data, error } = await context.supabase
      .from("content_remix_results")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as ContentRemixRow[];
  });

export const generateContentRemixFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { referenceId: string; preferredType?: string | null; notes?: string | null }) => input,
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { data: ref, error: refError } = await context.supabase
      .from("viral_content_references")
      .select("*")
      .eq("id", data.referenceId)
      .single();
    if (refError) throw new Error(refError.message);

    const { data: report, error: reportError } = await context.supabase
      .from("viral_analysis_reports")
      .select("*")
      .eq("reference_id", data.referenceId)
      .maybeSingle();
    if (reportError) throw new Error(reportError.message);
    if (!report)
      throw new Error("Jalankan Analisis AI dulu untuk referensi ini sebelum generate konten.");

    const analysis: Record<string, string> = {};
    for (const [k, v] of Object.entries(report)) {
      if (
        typeof v === "string" &&
        !["id", "reference_id", "user_id", "model", "created_at", "updated_at"].includes(k)
      ) {
        analysis[k] = v;
      }
    }

    const { generateContentRemix } = await import("@/lib/content-remix.server");
    const { result, model } = await generateContentRemix({
      title: ref.title,
      category: ref.category,
      platform: ref.source_platform,
      analysis,
      preferredType: data.preferredType ?? null,
      notes: data.notes ?? null,
    });

    const { error: upsertError } = await context.supabase.from("content_remix_results").upsert(
      {
        reference_id: data.referenceId,
        user_id: context.userId,
        model,
        content_angle: result.content_angle,
        angle_rationale: result.angle_rationale,
        structure_type: result.structure_type,
        content_type: result.content_type,
        slides: result.slides as unknown as never,
        captions: result.captions as unknown as never,
        hashtags: result.hashtags,
        ctas: result.ctas as unknown as never,
        quality_check: result.quality_check as unknown as never,
      },
      { onConflict: "reference_id" },
    );
    if (upsertError) throw new Error(upsertError.message);

    return { ok: true };
  });

export const deleteContentRemix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { referenceId: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("content_remix_results")
      .delete()
      .eq("reference_id", data.referenceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

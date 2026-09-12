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

/**
 * Legacy pipeline lock: hasil remix lama tetap tersimpan dan bisa dibaca,
 * tetapi tidak boleh lagi menghasilkan konten baru dari metadata.
 */
export const generateContentRemixFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { referenceId: string; preferredType?: string | null; notes?: string | null }) => input,
  )
  .handler(async (): Promise<never> => {
    const { LEGACY_PIPELINE_MESSAGE } = await import("@/lib/viral-analysis.functions");
    throw new Error(LEGACY_PIPELINE_MESSAGE);
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

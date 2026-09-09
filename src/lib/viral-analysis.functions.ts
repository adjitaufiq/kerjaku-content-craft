import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ViralAnalysisReport = {
  id: string;
  reference_id: string;
  content_summary: string;
  main_topic: string;
  content_category: string;
  storytelling_style: string;
  emotional_angle: string;
  hook_formula: string;
  pattern_interrupt: string;
  psychological_trigger: string;
  curiosity_gap: string;
  power_word: string;
  why_this_works: string;
  audience: string;
  problem: string;
  solution: string;
  modification_ideas: string;
  model: string;
  created_at: string;
  updated_at: string;
};

export const listAnalysisReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ViralAnalysisReport[]> => {
    const { data, error } = await context.supabase
      .from("viral_analysis_reports")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as ViralAnalysisReport[];
  });

export const analyzeViralReferenceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { referenceId: string; notes?: string | null }) => input)
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { data: ref, error: refError } = await context.supabase
      .from("viral_content_references")
      .select("*")
      .eq("id", data.referenceId)
      .single();
    if (refError) throw new Error(refError.message);

    await context.supabase
      .from("viral_content_references")
      .update({ content_analysis_status: "in_progress", status: "analyzing" })
      .eq("id", data.referenceId);

    try {
      const { analyzeViralReference } = await import("@/lib/viral-analysis.server");
      const { result, model } = await analyzeViralReference({
        title: ref.title,
        platform: ref.source_platform,
        category: ref.category,
        sourceUrl: ref.source_url,
        hasUpload: Boolean(ref.uploaded_file),
        notes: data.notes ?? null,
      });

      const { error: upsertError } = await context.supabase
        .from("viral_analysis_reports")
        .upsert(
          {
            reference_id: data.referenceId,
            user_id: context.userId,
            model,
            ...result,
          },
          { onConflict: "reference_id" },
        );
      if (upsertError) throw new Error(upsertError.message);

      await context.supabase
        .from("viral_content_references")
        .update({ content_analysis_status: "completed", status: "analyzed" })
        .eq("id", data.referenceId);

      return { ok: true };
    } catch (e) {
      await context.supabase
        .from("viral_content_references")
        .update({ content_analysis_status: "failed", status: "revision_needed" })
        .eq("id", data.referenceId);
      throw e instanceof Error ? e : new Error("Analisis AI gagal.");
    }
  });

export const deleteAnalysisReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { referenceId: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("viral_analysis_reports")
      .delete()
      .eq("reference_id", data.referenceId);
    if (error) throw new Error(error.message);
    await context.supabase
      .from("viral_content_references")
      .update({ content_analysis_status: "not_started" })
      .eq("id", data.referenceId);
    return { ok: true };
  });

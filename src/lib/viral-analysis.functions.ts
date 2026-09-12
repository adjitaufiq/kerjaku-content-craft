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

export const LEGACY_PIPELINE_MESSAGE =
  "Pipeline analisis lama sudah berstatus arsip (read only). Analisis baru hanya dijalankan lewat Cliper Intelligence: video sumber → ekstraksi → laporan sumber → Viral DNA.";

/**
 * Legacy pipeline lock: laporan lama tetap bisa dibaca dan dihapus, tetapi
 * tidak boleh lagi menghasilkan analisis baru berbasis judul/metadata.
 */
export const analyzeViralReferenceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { referenceId: string; notes?: string | null }) => input)
  .handler(async (): Promise<never> => {
    throw new Error(LEGACY_PIPELINE_MESSAGE);
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

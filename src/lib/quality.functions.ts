import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import type { AtmMode } from "@/lib/cliper-intelligence.functions";
import type { VisualPrompt } from "@/lib/content-production.server";
import {
  decideQuality,
  validateRules,
  validateStructure,
  type JudgeReport,
  type ProductionAssets,
  type QualityDecision,
  type RuleResult,
  type StructuralResult,
} from "@/lib/quality-gate";

export type ApprovalStatus = "draft" | "revision_needed" | "approved" | "ready_publish" | "published";

export type QualityRecord = {
  id: string;
  version_id: string;
  atm_mode: AtmMode;
  structural_result: StructuralResult;
  rule_result: RuleResult;
  judge_result: JudgeReport;
  pattern_score: number;
  trigger_score: number;
  curiosity_score: number;
  power_score: number;
  cta_score: number;
  source_fidelity_score: number;
  brand_safety: number;
  overall_score: number;
  status: "ready_production" | "revision_needed";
  hard_failures: string[];
  failed_criteria: QualityDecision["failedCriteria"];
  repair_attempted: boolean;
  repair_note: string;
  model: string;
  updated_at: string;
};

export type QualityWorkspace = {
  version: { id: string; angle: string; atm_mode: AtmMode; status: string; source_id: string } | null;
  hasProduction: boolean;
  quality: QualityRecord | null;
  library: {
    id: string;
    approval_status: ApprovalStatus;
    override_note: string;
    overridden_at: string | null;
    title: string;
  } | null;
};

export const getQualityWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { versionId: string }) => input)
  .handler(async ({ data, context }): Promise<QualityWorkspace> => {
    const [version, production, quality, library] = await Promise.all([
      context.supabase
        .from("kerjaku_versions")
        .select("id,angle,atm_mode,status,source_id")
        .eq("id", data.versionId)
        .maybeSingle(),
      context.supabase
        .from("content_production_results")
        .select("id")
        .eq("version_id", data.versionId)
        .maybeSingle(),
      context.supabase.from("quality_scores").select("*").eq("version_id", data.versionId).maybeSingle(),
      context.supabase
        .from("content_library")
        .select("id,approval_status,override_note,overridden_at,title")
        .eq("version_id", data.versionId)
        .maybeSingle(),
    ]);
    const error = version.error ?? production.error ?? quality.error ?? library.error;
    if (error) throw new Error(error.message);
    return {
      version: (version.data ?? null) as QualityWorkspace["version"],
      hasProduction: Boolean(production.data),
      quality: (quality.data ?? null) as QualityRecord | null,
      library: (library.data ?? null) as QualityWorkspace["library"],
    };
  });

export const runQualityGate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { versionId: string }) => input)
  .handler(async ({ data, context }): Promise<{ status: "ready_production" | "revision_needed"; repaired: boolean }> => {
    const supabase = context.supabase;

    const { data: version, error: versionError } = await supabase
      .from("kerjaku_versions")
      .select("*")
      .eq("id", data.versionId)
      .maybeSingle();
    if (versionError) throw new Error(versionError.message);
    if (!version) throw new Error("Versi KERJAKU tidak ditemukan.");

    const [production, extraction, dna, source, profile, products, rules, words, storyboard] = await Promise.all([
      supabase.from("content_production_results").select("*").eq("version_id", version.id).maybeSingle(),
      supabase.from("source_extractions").select("*").eq("source_id", version.source_id).maybeSingle(),
      supabase.from("viral_intelligence").select("*").eq("source_id", version.source_id).maybeSingle(),
      supabase.from("viral_sources").select("*").eq("id", version.source_id).maybeSingle(),
      supabase.from("brand_profile").select("*").maybeSingle(),
      supabase.from("brand_products").select("name,description,benefit").order("created_at"),
      supabase.from("brand_rules").select("rule,rule_type").order("created_at"),
      supabase.from("brand_power_words").select("word,context").order("created_at"),
      supabase.from("video_storyboards").select("*").eq("version_id", version.id).maybeSingle(),
    ]);
    const queryError =
      production.error ??
      extraction.error ??
      dna.error ??
      source.error ??
      profile.error ??
      products.error ??
      rules.error ??
      words.error ??
      storyboard.error;
    if (queryError) throw new Error(queryError.message);
    if (!production.data) throw new Error("Aset Content Production belum tersedia untuk versi ini.");
    if (!extraction.data) throw new Error("Source Content Report belum tersedia.");

    const brand = {
      profile: {
        brand_name: profile.data?.brand_name ?? "KERJAKU",
        positioning: profile.data?.positioning ?? "",
        audience: profile.data?.audience ?? "",
        tone_of_voice: profile.data?.tone_of_voice ?? "",
        mission: profile.data?.mission ?? "",
        version: profile.data?.version ?? "v1",
      },
      products: products.data ?? [],
      rules: rules.data ?? [],
      power_words: words.data ?? [],
    };

    const sourceReport = (extraction.data as { source_report: unknown }).source_report;
    const referenceCorpus = JSON.stringify({
      sourceReport,
      transcript: (extraction.data as { transcript: unknown }).transcript,
      onScreenText: (extraction.data as { on_screen_text: unknown }).on_screen_text,
      brand,
    });

    const toAssets = (row: Record<string, unknown>): ProductionAssets => ({
      content_info: row["content_info"] as ProductionAssets["content_info"],
      carousel_structure: (row["carousel_structure"] ?? []) as ProductionAssets["carousel_structure"],
      caption_options: (row["caption_options"] ?? []) as ProductionAssets["caption_options"],
      cta_options: (row["cta_options"] ?? []) as ProductionAssets["cta_options"],
      hashtags: (row["hashtags"] ?? { broad: [], niche: [], brand: [] }) as ProductionAssets["hashtags"],
    });

    const ruleContext = (assets: ProductionAssets) => ({
      assets,
      allowedProductNames: (products.data ?? []).map((product) => product.name),
      referenceCorpus,
      brandName: brand.profile.brand_name,
      topicKeywords: `${assets.content_info?.content_angle ?? ""} ${assets.content_info?.title ?? ""}`.split(/\s+/),
      audienceKeywords: `${assets.content_info?.target_audience ?? ""} ${brand.profile.audience}`.split(/\s+/),
    });

    const { judgeContentQuality } = await import("@/lib/quality-judge.server");

    async function evaluate(assets: ProductionAssets) {
      const structural = validateStructure(assets);
      const ruleResult = validateRules(ruleContext(assets));
      // Layer 3 hanya dijalankan bila struktur lolos; struktur gagal = FAILED, tidak lanjut.
      if (!structural.passed) {
        const emptyScore = { score: 0, reason: "Validasi struktur gagal.", improvement_suggestion: "Lengkapi field wajib." };
        const judge: JudgeReport = {
          pattern_interrupt: emptyScore,
          psychological_trigger: emptyScore,
          curiosity_gap: emptyScore,
          power_word: emptyScore,
          cta: emptyScore,
          source_fidelity: emptyScore,
          brand_safety: emptyScore,
          summary: "Penilaian AI dilewati karena validasi struktur gagal.",
        };
        return {
          structural,
          ruleResult,
          judge,
          model: "",
          decision: decideQuality({ mode: version!.atm_mode, structural, rules: ruleResult, judge }),
        };
      }
      const judged = await judgeContentQuality({
        mode: version!.atm_mode,
        assets,
        sourceReport,
        brandKnowledge: brand,
      });
      return {
        structural,
        ruleResult,
        judge: judged.report,
        model: judged.model,
        decision: decideQuality({ mode: version!.atm_mode, structural, rules: ruleResult, judge: judged.report }),
      };
    }

    let currentRow = production.data as Record<string, unknown>;
    let assets = toAssets(currentRow);
    let evaluation = await evaluate(assets);
    let repaired = false;
    let repairNote = "";

    // AUTO REPAIR — satu kali saja.
    if (evaluation.decision.status === "revision_needed" && dna.data) {
      const notes = [
        ...evaluation.decision.failedCriteria.map((item) => `${item.criteria}: ${item.detail} → ${item.improvement}`),
      ];
      try {
        const { generateContentProduction } = await import("@/lib/content-production.server");
        const regenerated = await generateContentProduction({
          mode: version.atm_mode,
          angle: version.angle,
          dna: dna.data as unknown as Parameters<typeof generateContentProduction>[0]["dna"],
          sourceReport,
          sourceMapping: version.source_mapping,
          adaptation: version.adaptation,
          brand,
          repairNotes: notes,
        });
        const { error: saveError } = await supabase.from("content_production_results").upsert(
          {
            version_id: version.id,
            user_id: context.userId,
            atm_mode: version.atm_mode,
            content_info: regenerated.result.content_info as unknown as Json,
            carousel_structure: regenerated.result.carousel_structure as unknown as Json,
            visual_prompts: regenerated.result.visual_prompts as unknown as Json,
            caption_options: regenerated.result.caption_options as unknown as Json,
            cta_options: regenerated.result.cta_options as unknown as Json,
            hashtags: regenerated.result.hashtags as unknown as Json,
            model: regenerated.model,
          },
          { onConflict: "version_id" },
        );
        if (saveError) throw new Error(saveError.message);
        currentRow = {
          ...currentRow,
          content_info: regenerated.result.content_info,
          carousel_structure: regenerated.result.carousel_structure,
          visual_prompts: regenerated.result.visual_prompts,
          caption_options: regenerated.result.caption_options,
          cta_options: regenerated.result.cta_options,
          hashtags: regenerated.result.hashtags,
        };
        assets = toAssets(currentRow);
        evaluation = await evaluate(assets);
        repaired = true;
        repairNote = `Perbaikan otomatis 1x dijalankan pada ${new Date().toISOString()}. ${notes.length} temuan dikirim ulang ke generator.`;
      } catch (error) {
        repairNote = `Perbaikan otomatis gagal: ${(error as Error).message}`;
      }
    }

    const judge = evaluation.judge;
    const { error: qualityError } = await supabase.from("quality_scores").upsert(
      {
        version_id: version.id,
        user_id: context.userId,
        atm_mode: version.atm_mode,
        structural_result: evaluation.structural as unknown as Json,
        rule_result: evaluation.ruleResult as unknown as Json,
        judge_result: judge as unknown as Json,
        pattern_score: judge.pattern_interrupt.score,
        trigger_score: judge.psychological_trigger.score,
        curiosity_score: judge.curiosity_gap.score,
        power_score: judge.power_word.score,
        cta_score: judge.cta.score,
        source_fidelity_score: judge.source_fidelity.score,
        brand_safety: judge.brand_safety.score,
        overall_score: evaluation.decision.overall,
        status: evaluation.decision.status,
        hard_failures: evaluation.decision.hardFailures,
        failed_criteria: evaluation.decision.failedCriteria as unknown as Json,
        repair_attempted: repaired,
        repair_note: repairNote,
        model: evaluation.model,
      },
      { onConflict: "version_id" },
    );
    if (qualityError) throw new Error(qualityError.message);

    // CONTENT BANK — simpan seluruh intelligence konten.
    const { data: existingLibrary } = await supabase
      .from("content_library")
      .select("id,approval_status")
      .eq("version_id", version.id)
      .maybeSingle();
    const lockedStatus = existingLibrary?.approval_status === "published";
    const nextStatus: ApprovalStatus = lockedStatus
      ? "published"
      : evaluation.decision.status === "ready_production"
        ? "approved"
        : "revision_needed";

    const dnaRow = dna.data as Record<string, unknown> | null;
    const sourceRow = source.data as Record<string, unknown> | null;

    const { error: libraryError } = await supabase.from("content_library").upsert(
      {
        version_id: version.id,
        user_id: context.userId,
        source_id: version.source_id,
        title: (assets.content_info?.title ?? version.angle) || "Konten KERJAKU",
        category: (sourceRow?.["category"] as string | null) ?? null,
        atm_mode: version.atm_mode,
        hook_type: (dnaRow?.["hook_type"] as string) ?? "",
        source_data: {
          platform: sourceRow?.["platform"] ?? null,
          creator: sourceRow?.["creator_name"] ?? null,
          category: sourceRow?.["category"] ?? null,
          source_url: sourceRow?.["source_url"] ?? null,
          transcript: (extraction.data as Record<string, unknown>)["transcript"] ?? [],
          source_report: sourceReport,
        } as unknown as Json,
        viral_attributes: {
          hook: dnaRow?.["hook"] ?? "",
          hook_type: dnaRow?.["hook_type"] ?? "",
          pattern_interrupt: dnaRow?.["pattern_interrupt"] ?? "",
          psychological_trigger: dnaRow?.["psychological_trigger"] ?? "",
          curiosity_gap: dnaRow?.["curiosity_gap"] ?? "",
          power_words: dnaRow?.["power_words"] ?? [],
          structure_type: dnaRow?.["structure_type"] ?? "",
        } as unknown as Json,
        content_assets: {
          atm_mode: version.atm_mode,
          angle: version.angle,
          content_info: assets.content_info,
          carousel: assets.carousel_structure,
          visual_prompt: (currentRow["visual_prompts"] ?? []) as VisualPrompt[],
          caption: assets.caption_options,
          cta: assets.cta_options,
          hashtags: assets.hashtags,
          storyboard: storyboard.data
            ? {
                scenes: (storyboard.data as Record<string, unknown>)["scenes"],
                video_package: (storyboard.data as Record<string, unknown>)["video_package"],
              }
            : null,
        } as unknown as Json,
        quality_result: {
          overall_score: evaluation.decision.overall,
          status: evaluation.decision.status,
          source_fidelity: judge.source_fidelity.score,
          brand_safety: judge.brand_safety.score,
          failed_criteria: evaluation.decision.failedCriteria,
          repair_attempted: repaired,
        } as unknown as Json,
        approval_status: nextStatus,
      },
      { onConflict: "version_id" },
    );
    if (libraryError) throw new Error(libraryError.message);

    return { status: evaluation.decision.status, repaired };
  });

export const overrideApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { versionId: string; status: ApprovalStatus; note: string }) => input)
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    if (!data.note.trim()) throw new Error("Catatan override wajib diisi agar keputusan manusia tercatat.");
    const { error } = await context.supabase
      .from("content_library")
      .update({
        approval_status: data.status,
        override_note: data.note.trim(),
        overridden_at: new Date().toISOString(),
        overridden_by: context.userId,
        ...(data.status === "published" ? { published_at: new Date().toISOString() } : {}),
      })
      .eq("version_id", data.versionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

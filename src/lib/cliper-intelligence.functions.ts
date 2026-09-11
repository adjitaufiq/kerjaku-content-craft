import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { evaluateExtractionGate } from "@/lib/extraction-gate";
import type { SourceExtraction, SourceReportData } from "@/lib/video-understanding.functions";

export type AtmMode = "conservative" | "creative";
export type AtmStatus = "draft" | "pending_approval" | "approved" | "rejected";
export type DnaEvidence = {
  source_type: "transcript" | "on_screen_text" | "visual";
  timestamp: string;
  quote: string;
};
export type ViralDna = {
  id: string;
  hook: string;
  hook_type: string;
  hook_reason: string;
  pattern_interrupt: string;
  psychological_trigger: string;
  curiosity_gap: string;
  power_words: string[];
  structure_type: string;
  story_beats: Array<{
    order: number;
    role: string;
    description: string;
    evidence: DnaEvidence[];
  }>;
  retention_factor: string;
  engagement_factor: string;
  evidence: DnaEvidence[];
  model: string;
  updated_at: string;
};
export type AtmVersion = {
  id: string;
  atm_mode: AtmMode;
  angle: string;
  source_mapping: {
    preserved_formula?: string[];
    changed_elements?: string[];
    evidence_links?: DnaEvidence[];
  };
  adaptation: {
    strategic_premise?: string;
    target_audience_relevance?: string;
    storytelling_direction?: string;
    brand_voice_direction?: string;
    product_connection?: string;
    originality_safeguards?: string[];
  };
  reason: string;
  brand_profile_version: string;
  status: AtmStatus;
  approval_note: string;
  approved_at: string | null;
  model: string;
  created_at: string;
};
export type IntelligenceWorkspace = { dna: ViralDna | null; versions: AtmVersion[] };

function collectVerifiedEvidence(value: unknown, result: DnaEvidence[] = []): DnaEvidence[] {
  if (!value || typeof value !== "object") return result;
  if (Array.isArray(value)) {
    value.forEach((item) => collectVerifiedEvidence(item, result));
    return result;
  }
  const row = value as Record<string, unknown>;
  if (
    row["verified"] === true &&
    (row["source_type"] === "transcript" ||
      row["source_type"] === "on_screen_text" ||
      row["source_type"] === "visual") &&
    typeof row["timestamp"] === "string" &&
    typeof row["quote"] === "string"
  ) {
    result.push({
      source_type: row["source_type"],
      timestamp: row["timestamp"],
      quote: row["quote"],
    });
  }
  Object.values(row).forEach((item) => collectVerifiedEvidence(item, result));
  return result;
}

function evidenceKey(item: DnaEvidence) {
  return `${item.source_type}|${item.timestamp.trim()}|${item.quote.trim().toLowerCase()}`;
}

function lockDnaEvidence<T extends {
  evidence: DnaEvidence[];
  story_beats: Array<{ evidence: DnaEvidence[] }>;
}>(result: T, report: SourceReportData): T {
  const allowed = new Set(collectVerifiedEvidence(report).map(evidenceKey));
  const keep = (items: DnaEvidence[]) => items.filter((item) => allowed.has(evidenceKey(item)));
  return {
    ...result,
    evidence: keep(result.evidence ?? []),
    story_beats: (result.story_beats ?? []).map((beat) => ({ ...beat, evidence: keep(beat.evidence ?? []) })),
  };
}

async function getOwnedExtraction(
  context: Parameters<Parameters<typeof requireSupabaseAuth>[0]>[0] extends never ? never : never,
  _sourceId: string,
) {
  return context;
}

export const getIntelligenceWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sourceId: string }) => input)
  .handler(async ({ data, context }): Promise<IntelligenceWorkspace> => {
    const [dna, versions] = await Promise.all([
      context.supabase.from("viral_intelligence").select("*").eq("source_id", data.sourceId).maybeSingle(),
      context.supabase
        .from("kerjaku_versions")
        .select("*")
        .eq("source_id", data.sourceId)
        .order("created_at", { ascending: false }),
    ]);
    const error = dna.error ?? versions.error;
    if (error) throw new Error(error.message);
    return {
      dna: (dna.data ?? null) as ViralDna | null,
      versions: (versions.data ?? []) as AtmVersion[],
    };
  });

export const runViralDnaAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sourceId: string }) => input)
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { data: extraction, error } = await context.supabase
      .from("source_extractions")
      .select("*")
      .eq("source_id", data.sourceId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const typedExtraction = extraction as SourceExtraction | null;
    const gate = evaluateExtractionGate(typedExtraction);
    if (!gate.allowed || !typedExtraction) throw new Error(gate.reason);

    const { analyzeViralDna } = await import("@/lib/cliper-intelligence.server");
    const generated = await analyzeViralDna(typedExtraction.source_report);
    const result = lockDnaEvidence(generated.result, typedExtraction.source_report);
    const { error: saveError } = await context.supabase.from("viral_intelligence").upsert(
      {
        source_id: data.sourceId,
        user_id: context.userId,
        ...result,
        story_beats: result.story_beats as unknown as Json,
        evidence: result.evidence as unknown as Json,
        model: generated.model,
      },
      { onConflict: "source_id" },
    );
    if (saveError) throw new Error(saveError.message);
    await context.supabase.from("viral_sources").update({ status: "analysis_complete" }).eq("id", data.sourceId);
    return { ok: true };
  });

export const generateKerjakuAtmVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sourceId: string; mode: AtmMode; angle: string }) => input)
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const angle = data.angle.trim();
    if (!angle) throw new Error("Angle wajib diisi sebelum menjalankan ATM Engine.");

    const [dna, profile, products, rules, words] = await Promise.all([
      context.supabase.from("viral_intelligence").select("*").eq("source_id", data.sourceId).maybeSingle(),
      context.supabase.from("brand_profile").select("*").maybeSingle(),
      context.supabase.from("brand_products").select("name,description,benefit").order("created_at"),
      context.supabase.from("brand_rules").select("rule,rule_type").order("created_at"),
      context.supabase.from("brand_power_words").select("word,context").order("created_at"),
    ]);
    const queryError = dna.error ?? profile.error ?? products.error ?? rules.error ?? words.error;
    if (queryError) throw new Error(queryError.message);
    if (!dna.data) throw new Error("Jalankan Viral DNA Analysis terlebih dahulu.");
    if (!profile.data?.positioning || !profile.data.audience || !profile.data.tone_of_voice) {
      throw new Error("Lengkapi positioning, audience, dan tone of voice di Brand Knowledge terlebih dahulu.");
    }

    const { generateAtmVersion } = await import("@/lib/cliper-intelligence.server");
    const generated = await generateAtmVersion({
      mode: data.mode,
      angle,
      dna: dna.data as unknown as Parameters<typeof generateAtmVersion>[0]["dna"],
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
    const { data: saved, error: saveError } = await context.supabase
      .from("kerjaku_versions")
      .insert({
        source_id: data.sourceId,
        user_id: context.userId,
        atm_mode: data.mode,
        angle,
        source_mapping: generated.result.source_mapping as unknown as Json,
        adaptation: generated.result.adaptation as unknown as Json,
        reason: generated.result.reason,
        brand_profile_version: profile.data.version,
        status: "pending_approval",
        model: generated.model,
      })
      .select("id")
      .single();
    if (saveError) throw new Error(saveError.message);
    return { id: saved.id };
  });

export const reviewKerjakuAtmVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { versionId: string; decision: "approved" | "rejected"; note: string }) => input)
  .handler(async ({ data, context }) => {
    const note = data.note.trim();
    if (data.decision === "rejected" && !note) throw new Error("Alasan revisi wajib diisi saat menolak versi.");
    const { data: version, error: readError } = await context.supabase
      .from("kerjaku_versions")
      .select("source_id")
      .eq("id", data.versionId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!version) throw new Error("Versi ATM tidak ditemukan.");

    const { error } = await context.supabase
      .from("kerjaku_versions")
      .update({
        status: data.decision,
        approval_note: note,
        approved_at: data.decision === "approved" ? new Date().toISOString() : null,
      })
      .eq("id", data.versionId);
    if (error) throw new Error(error.message);
    if (data.decision === "approved") {
      await context.supabase.from("viral_sources").update({ status: "approved" }).eq("id", version.source_id);
    }
    return { ok: true };
  });

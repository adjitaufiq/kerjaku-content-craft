import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { evaluateReadiness } from "@/lib/brand-knowledge.functions";
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
  save_trigger: string;
  share_trigger: string;
  comment_trigger: string;
  hook_category: string;
  structure_category: string;
  trigger_category: string;
  confidence_score: number;
  evidence: DnaEvidence[];
  model: string;
  updated_at: string;
};
export type HookCandidate = {
  id: string;
  hook: string;
  hook_type: string;
  rationale: string;
  psychological_trigger: string;
  curiosity_gap: string;
  power_words: string[];
  risk_note: string;
};
export type AtmVersion = {
  id: string;
  hook_candidates: HookCandidate[];
  selected_hook: HookCandidate | null;
  hook_selected_at: string | null;
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
    source_formula?: string[];
    target_audience?: string;
    angle_ideas?: string[];
    example_hooks?: string[];
    recommended_format?: string;
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

const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();

/** Bahan bukti mentah: transcript, teks layar, snapshot, dan analisis visual. */
type RawMaterial = {
  transcript?: Array<{ timestamp: string; text: string }> | null;
  on_screen_text?: Array<{ timestamp: string; text: string }> | null;
  snapshot_data?: Array<{ timestamp: string; reason: string }> | null;
  visual_analysis?: Array<{ timestamp: string; scene: string; description: string }> | null;
};

function rawEvidenceIndex(material: RawMaterial) {
  const index = new Map<string, string>();
  const add = (type: DnaEvidence["source_type"], timestamp: string, text: string) => {
    const key = `${type}|${timestamp.trim()}`;
    index.set(key, `${index.get(key) ?? ""} ${normalize(text)}`.trim());
  };
  (material.transcript ?? []).forEach((row) => add("transcript", row.timestamp, row.text));
  (material.on_screen_text ?? []).forEach((row) => add("on_screen_text", row.timestamp, row.text));
  (material.snapshot_data ?? []).forEach((row) => add("visual", row.timestamp, row.reason));
  (material.visual_analysis ?? []).forEach((row) =>
    add("visual", row.timestamp, `${row.scene} ${row.description}`),
  );
  return index;
}

function lockDnaEvidence<T extends {
  evidence: DnaEvidence[];
  story_beats: Array<{ evidence: DnaEvidence[] }>;
}>(result: T, report: SourceReportData, material: RawMaterial = {}): T {
  const allowed = new Set(collectVerifiedEvidence(report).map(evidenceKey));
  const raw = rawEvidenceIndex(material);
  const supported = (item: DnaEvidence) => {
    if (allowed.has(evidenceKey(item))) return true;
    const text = raw.get(`${item.source_type}|${item.timestamp.trim()}`);
    if (!text) return false;
    const quote = normalize(item.quote);
    if (!quote) return false;
    return text.includes(quote) || quote.includes(text);
  };
  const keep = (items: DnaEvidence[]) => items.filter(supported);
  return {
    ...result,
    evidence: keep(result.evidence ?? []),
    story_beats: (result.story_beats ?? []).map((beat) => ({ ...beat, evidence: keep(beat.evidence ?? []) })),
  };
}

/**
 * Skor keyakinan DNA: gabungan keyakinan laporan sumber dan seberapa banyak
 * klaim DNA benar-benar ditopang bukti terverifikasi.
 */
function scoreDnaConfidence(
  result: { evidence: DnaEvidence[]; story_beats: Array<{ evidence: DnaEvidence[] }> },
  extraction: { report_confidence?: number | null; confidence_score: number },
): number {
  const base = extraction.report_confidence ?? extraction.confidence_score;
  const beats = result.story_beats ?? [];
  const supportedBeats = beats.filter((beat) => (beat.evidence ?? []).length > 0).length;
  const beatRatio = beats.length ? supportedBeats / beats.length : 0;
  const hasOverallEvidence = (result.evidence ?? []).length > 0 ? 1 : 0;
  const support = beatRatio * 0.8 + hasOverallEvidence * 0.2;
  return Math.max(0, Math.min(100, Math.round(base * 0.5 + support * 50)));
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
      versions: (versions.data ?? []) as unknown as AtmVersion[],
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
    const rawMaterial: RawMaterial = {
      transcript: (typedExtraction.transcript ?? []) as NonNullable<RawMaterial["transcript"]>,
      on_screen_text: (typedExtraction.on_screen_text ?? []) as NonNullable<RawMaterial["on_screen_text"]>,
      snapshot_data: (typedExtraction.snapshot_data ?? []) as NonNullable<RawMaterial["snapshot_data"]>,
      visual_analysis: (typedExtraction.visual_analysis ?? []) as NonNullable<RawMaterial["visual_analysis"]>,
    };

    const generated = await analyzeViralDna({
      source_report: typedExtraction.source_report,
      transcript: rawMaterial.transcript ?? [],
      on_screen_text: rawMaterial.on_screen_text ?? [],
      snapshots: rawMaterial.snapshot_data ?? [],
      visual_analysis: rawMaterial.visual_analysis ?? [],
    });
    const result = lockDnaEvidence(generated.result, typedExtraction.source_report, rawMaterial);

    const { error: saveError } = await context.supabase.from("viral_intelligence").upsert(
      {
        source_id: data.sourceId,
        user_id: context.userId,
        ...result,
        story_beats: result.story_beats as unknown as Json,
        evidence: result.evidence as unknown as Json,
        confidence_score: scoreDnaConfidence(result, typedExtraction),
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
  .inputValidator((input: { sourceId: string; mode: AtmMode; angle?: string }) => input)
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    // Angle bersifat opsional: ATM otomatis membaca Viral DNA sebagai sumber utama.
    const angle = (data.angle ?? "").trim();

    const [extraction, dna, profile, products, rules, words] = await Promise.all([
      context.supabase.from("source_extractions").select("*").eq("source_id", data.sourceId).maybeSingle(),
      context.supabase.from("viral_intelligence").select("*").eq("source_id", data.sourceId).maybeSingle(),
      context.supabase.from("brand_profile").select("*").maybeSingle(),
      context.supabase.from("brand_products").select("*").order("created_at"),
      context.supabase.from("brand_rules").select("*").order("created_at"),
      context.supabase.from("brand_power_words").select("*").order("created_at"),
    ]);
    const queryError =
      extraction.error ?? dna.error ?? profile.error ?? products.error ?? rules.error ?? words.error;
    if (queryError) throw new Error(queryError.message);

    // Single source of truth: ATM hanya menerima sumber dari pipeline baru yang
    // laporan sumbernya lolos gerbang mutu ekstraksi.
    const typedExtraction = extraction.data as SourceExtraction | null;
    const gate = evaluateExtractionGate(typedExtraction);
    if (!gate.allowed) throw new Error(gate.reason);
    if (!dna.data) throw new Error("Jalankan Viral DNA Analysis terlebih dahulu.");

    // Brand Center BUKAN hard blocker: field kosong diisi konteks source lalu AI default.
    const text = (value: unknown) => String(value ?? "").trim();
    const p = (profile.data ?? {}) as Record<string, unknown>;
    const brandProfile = {
      brand_name: text(p["brand_name"]) || "@kerjaku.space",
      positioning: text(p["positioning"]),
      description: text(p["description"]),
      audience: text(p["audience"]),
      customer_problem: text(p["customer_problem"]),
      customer_desire: text(p["customer_desire"]),
      tone_of_voice: text(p["tone_of_voice"]),
      personality: text(p["personality"]),
      writing_style: text(p["writing_style"]),
      mission: text(p["mission"]),
      visual_direction: text(p["visual_direction"]),
      preferred_style: text(p["preferred_style"]),
      forbidden_style: text(p["forbidden_style"]),
      version: text(p["version"]) || "v0",
    };
    const brandProducts = (products.data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        name: text(r["name"]),
        description: text(r["description"]),
        benefit: text(r["benefit"]),
        status: r["status"] === "inactive" ? ("inactive" as const) : ("active" as const),
        category: text(r["category"]),
        features: [] as string[],
        target_user: "",
        allowed_claims: [] as string[],
        forbidden_claims: [] as string[],
      };
    });
    const brandRules = (rules.data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        rule: text(r["rule"]),
        rule_type: r["rule_type"] === "dont" ? ("dont" as const) : ("do" as const),
        rule_category:
          r["rule_category"] === "forbidden"
            ? ("forbidden" as const)
            : r["rule_category"] === "claim_control"
              ? ("claim_control" as const)
              : ("allow" as const),
        severity: r["severity"] === "hard_fail" ? ("hard_fail" as const) : ("warning" as const),
      };
    });
    const brandWords = (words.data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        word: text(r["word"]),
        context: text(r["context"]),
        category: text(r["category"]),
        usage_example: text(r["usage_example"]),
        forbidden_usage: text(r["forbidden_usage"]),
      };
    });

    const readiness = evaluateReadiness(brandProfile, brandProducts, brandRules, brandWords);

    const { generateAtmVersion } = await import("@/lib/cliper-intelligence.server");
    const generated = await generateAtmVersion({
      mode: data.mode,
      angle,
      dna: dna.data as unknown as Parameters<typeof generateAtmVersion>[0]["dna"],
      readiness_level: readiness.level,
      assumed_fields: readiness.missing_fields,
      source_context: {
        source_report: typedExtraction?.source_report ?? null,
        transcript: (typedExtraction?.transcript ?? []) as unknown,
        on_screen_text: (typedExtraction?.on_screen_text ?? []) as unknown,
      },
      brand: {
        profile: {
          brand_name: brandProfile.brand_name,
          positioning: brandProfile.positioning,
          audience: brandProfile.audience,
          tone_of_voice: brandProfile.tone_of_voice,
          mission: brandProfile.mission,
          version: brandProfile.version,
        },
        products: brandProducts.map((item) => ({
          name: item.name,
          description: item.description,
          benefit: item.benefit,
        })),
        rules: brandRules.map((item) => ({ rule: item.rule, rule_type: item.rule_type })),
        power_words: brandWords.map((item) => ({ word: item.word, context: item.context })),
      },
    });

    const context_sources = [
      ...(readiness.level === "EMPTY" ? [] : ["BRAND_CENTER"]),
      "SOURCE",
      "TRANSCRIPT",
      "VIRAL_DNA",
      ...(readiness.level === "COMPLETE" ? [] : ["AI_DEFAULT"]),
    ];

    const { data: saved, error: saveError } = await context.supabase
      .from("kerjaku_versions")
      .insert({
        source_id: data.sourceId,
        user_id: context.userId,
        atm_mode: data.mode,
        angle: angle || "Otomatis dari Viral DNA",
        source_mapping: generated.result.source_mapping as unknown as Json,
        adaptation: {
          ...generated.result.adaptation,
          brand_context: {
            brand_readiness: readiness.level,
            context_sources,
            used_ai_assumption: readiness.level !== "COMPLETE",
            assumed_fields: readiness.missing_fields,
          },
        } as unknown as Json,
        reason: generated.result.reason,
        brand_profile_version: brandProfile.version,
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

/** Hook Matrix: 5 kandidat hook orisinal dari versi ATM yang sudah disetujui. */
export const generateHookMatrix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { versionId: string }) => input)
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { data: version, error: versionError } = await context.supabase
      .from("kerjaku_versions")
      .select("*")
      .eq("id", data.versionId)
      .maybeSingle();
    if (versionError) throw new Error(versionError.message);
    if (!version) throw new Error("Versi ATM tidak ditemukan.");
    if (version.status !== "approved") throw new Error("Setujui arah ATM terlebih dahulu sebelum membuat Hook Matrix.");

    const [dna, profile, products, rules, words] = await Promise.all([
      context.supabase.from("viral_intelligence").select("*").eq("source_id", version.source_id).maybeSingle(),
      context.supabase.from("brand_profile").select("*").maybeSingle(),
      context.supabase.from("brand_products").select("name,description,benefit").order("created_at"),
      context.supabase.from("brand_rules").select("rule,rule_type").order("created_at"),
      context.supabase.from("brand_power_words").select("word,context").order("created_at"),
    ]);
    const queryError = dna.error ?? profile.error ?? products.error ?? rules.error ?? words.error;
    if (queryError) throw new Error(queryError.message);
    if (!dna.data) throw new Error("Viral DNA tidak ditemukan untuk sumber ini.");
    if (!profile.data?.positioning) throw new Error("Lengkapi Brand Knowledge terlebih dahulu.");

    const { generateHookMatrix: runHookMatrix } = await import("@/lib/cliper-intelligence.server");
    const generated = await runHookMatrix({
      mode: version.atm_mode as AtmMode,
      angle: version.angle,
      dna: dna.data as unknown as Parameters<typeof runHookMatrix>[0]["dna"],
      atm: {
        source_mapping: version.source_mapping as never,
        adaptation: version.adaptation as never,
        reason: version.reason,
      },
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

    const candidates = (generated.result.candidates ?? []).slice(0, 5);
    if (candidates.length < 5) throw new Error("Hook Matrix belum lengkap. Jalankan ulang pembuatan hook.");

    const { error: saveError } = await context.supabase
      .from("kerjaku_versions")
      .update({
        hook_candidates: candidates as unknown as Json,
        selected_hook: null,
        hook_selected_at: null,
      } as never)
      .eq("id", data.versionId);
    if (saveError) throw new Error(saveError.message);
    return { ok: true };
  });

/** Pemilihan hook final oleh manusia; menandai sumber siap masuk tahap prompt. */
export const selectHookCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { versionId: string; hookId: string }) => input)
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { data: version, error } = await context.supabase
      .from("kerjaku_versions")
      .select("*")
      .eq("id", data.versionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!version) throw new Error("Versi ATM tidak ditemukan.");

    const candidates = ((version as unknown as { hook_candidates?: HookCandidate[] }).hook_candidates ?? []);
    const picked = candidates.find((item) => item.id === data.hookId);
    if (!picked) throw new Error("Hook yang dipilih tidak ada dalam Hook Matrix.");

    const { error: saveError } = await context.supabase
      .from("kerjaku_versions")
      .update({
        selected_hook: picked as unknown as Json,
        hook_selected_at: new Date().toISOString(),
      } as never)
      .eq("id", data.versionId);
    if (saveError) throw new Error(saveError.message);
    await context.supabase
      .from("viral_sources")
      .update({ status: "ready_for_prompt_generation" as never })
      .eq("id", version.source_id);
    return { ok: true };
  });

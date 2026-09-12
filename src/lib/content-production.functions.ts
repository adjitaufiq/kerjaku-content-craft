import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { evaluateExtractionGate } from "@/lib/extraction-gate";
import type { AtmMode } from "@/lib/cliper-intelligence.functions";
import type {
  CaptionOption,
  CarouselSlide,
  ContentInfo,
  CtaOption,
  HashtagSet,
  VisualPrompt,
} from "@/lib/content-production.server";
import type { SourceExtraction } from "@/lib/video-understanding.functions";

export type ProductionRecord = {
  id: string;
  version_id: string;
  atm_mode: AtmMode;
  content_info: ContentInfo;
  carousel_structure: CarouselSlide[];
  visual_prompts: VisualPrompt[];
  caption_options: CaptionOption[];
  cta_options: CtaOption[];
  hashtags: HashtagSet;
  model: string;
  created_at: string;
  updated_at: string;
};

export type ProductionWorkspace = {
  version: {
    id: string;
    angle: string;
    atm_mode: AtmMode;
    status: string;
    source_id: string;
    brand_profile_version: string;
  } | null;
  production: ProductionRecord | null;
};

export const getContentProduction = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { versionId: string }) => input)
  .handler(async ({ data, context }): Promise<ProductionWorkspace> => {
    const [version, production] = await Promise.all([
      context.supabase
        .from("kerjaku_versions")
        .select("id,angle,atm_mode,status,source_id,brand_profile_version")
        .eq("id", data.versionId)
        .maybeSingle(),
      context.supabase
        .from("content_production_results")
        .select("*")
        .eq("version_id", data.versionId)
        .maybeSingle(),
    ]);
    const error = version.error ?? production.error;
    if (error) throw new Error(error.message);
    return {
      version: (version.data ?? null) as ProductionWorkspace["version"],
      production: (production.data ?? null) as ProductionRecord | null,
    };
  });

export const runContentProduction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { versionId: string }) => input)
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { data: version, error: versionError } = await context.supabase
      .from("kerjaku_versions")
      .select("*")
      .eq("id", data.versionId)
      .maybeSingle();
    if (versionError) throw new Error(versionError.message);
    if (!version) throw new Error("Versi KERJAKU tidak ditemukan.");
    if (version.status !== "approved") {
      throw new Error("Versi KERJAKU harus disetujui lebih dahulu sebelum masuk produksi konten.");
    }

    const [extraction, dna, profile, products, rules, words] = await Promise.all([
      context.supabase.from("source_extractions").select("*").eq("source_id", version.source_id).maybeSingle(),
      context.supabase.from("viral_intelligence").select("*").eq("source_id", version.source_id).maybeSingle(),
      context.supabase.from("brand_profile").select("*").maybeSingle(),
      context.supabase.from("brand_products").select("name,description,benefit").order("created_at"),
      context.supabase.from("brand_rules").select("rule,rule_type").order("created_at"),
      context.supabase.from("brand_power_words").select("word,context").order("created_at"),
    ]);
    const queryError =
      extraction.error ?? dna.error ?? profile.error ?? products.error ?? rules.error ?? words.error;
    if (queryError) throw new Error(queryError.message);

    const gate = evaluateExtractionGate(extraction.data as SourceExtraction | null);
    if (!gate.allowed) throw new Error(gate.reason);
    if (!dna.data) throw new Error("Viral DNA belum tersedia untuk sumber ini.");
    if (!profile.data?.positioning || !profile.data.audience || !profile.data.tone_of_voice) {
      throw new Error("Lengkapi positioning, audience, dan tone of voice di Brand Center terlebih dahulu.");
    }

    const { generateContentProduction } = await import("@/lib/content-production.server");
    const generated = await generateContentProduction({
      mode: version.atm_mode,
      angle: version.angle,
      dna: dna.data as unknown as Parameters<typeof generateContentProduction>[0]["dna"],
      sourceReport: (extraction.data as SourceExtraction).source_report,
      sourceMapping: version.source_mapping,
      adaptation: version.adaptation,
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

    const { error: saveError } = await context.supabase.from("content_production_results").upsert(
      {
        version_id: version.id,
        user_id: context.userId,
        atm_mode: version.atm_mode,
        content_info: generated.result.content_info as unknown as Json,
        carousel_structure: generated.result.carousel_structure as unknown as Json,
        visual_prompts: generated.result.visual_prompts as unknown as Json,
        caption_options: generated.result.caption_options as unknown as Json,
        cta_options: generated.result.cta_options as unknown as Json,
        hashtags: generated.result.hashtags as unknown as Json,
        model: generated.model,
      },
      { onConflict: "version_id" },
    );
    if (saveError) throw new Error(saveError.message);

    await context.supabase.from("viral_sources").update({ status: "production" }).eq("id", version.source_id);
    return { ok: true };
  });

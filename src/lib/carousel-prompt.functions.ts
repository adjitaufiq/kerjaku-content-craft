import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import {
  NEGATIVE_PROMPT_SUFFIX,
  validateCarouselPackage,
  type CarouselPromptPackage,
  type CarouselPromptRecord,
  type CarouselPromptSlide,
  type CarouselPromptStatus,
  type CarouselTextLevel,
} from "@/lib/carousel-prompt.types";

export const SELECTED_CONCEPT_REQUIRED_MESSAGE =
  "Pilih dan simpan satu konsep final dari Hook Matrix sebelum membuat Prompt Carousel.";

export type CarouselPromptState = {
  status: CarouselPromptStatus | "SELECTED_CONCEPT_REQUIRED";
  message: string;
  record: CarouselPromptRecord | null;
};

type SelectedHook = {
  id?: string;
  hook: string;
  hook_type?: string;
  rationale?: string;
  psychological_trigger?: string;
  curiosity_gap?: string;
  pattern_interrupt?: string;
  power_words?: string[];
};

function toRecord(row: Record<string, unknown>): CarouselPromptRecord {
  return {
    id: row["id"] as string,
    version_id: row["version_id"] as string,
    source_id: row["source_id"] as string,
    status: row["status"] as CarouselPromptStatus,
    slide_count: row["slide_count"] as number,
    visual_style: row["visual_style"] as string,
    text_level: row["text_level"] as CarouselTextLevel,
    package: row["package"] as unknown as CarouselPromptPackage,
    slides: (row["slides"] ?? []) as unknown as CarouselPromptSlide[],
    validation: row["validation"] as CarouselPromptRecord["validation"],
    model: row["model"] as string,
    approved_at: (row["approved_at"] ?? null) as string | null,
    updated_at: row["updated_at"] as string,
  };
}

async function loadVersion(
  supabase: { from: (table: string) => any },
  versionId: string,
): Promise<{ version: any; concept: SelectedHook | null }> {
  const { data, error } = await supabase
    .from("kerjaku_versions")
    .select("id,source_id,angle,atm_mode,adaptation,source_mapping,selected_hook,status")
    .eq("id", versionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Versi KERJAKU tidak ditemukan.");
  const concept = (data.selected_hook ?? null) as SelectedHook | null;
  return { version: data, concept: concept && concept.hook ? concept : null };
}

type DnaFallback = {
  pattern_interrupt?: string | null;
  psychological_trigger?: string | null;
  curiosity_gap?: string | null;
  power_words?: string[] | null;
} | null;

function normalizeConcept(concept: SelectedHook, dna?: DnaFallback) {
  const pick = (value: string | undefined, fallback: string | null | undefined) =>
    (value && value.trim()) || (fallback ?? "").trim();
  return {
    hook: concept.hook,
    hook_type: concept.hook_type ?? "",
    rationale: concept.rationale ?? "",
    psychological_trigger: pick(concept.psychological_trigger, dna?.psychological_trigger),
    curiosity_gap: pick(concept.curiosity_gap, dna?.curiosity_gap),
    pattern_interrupt: pick(concept.pattern_interrupt, dna?.pattern_interrupt),
    power_words: concept.power_words?.length ? concept.power_words : (dna?.power_words ?? []),
  };
}

/** Selected Concept lama tidak menyimpan semua atribut viral; ambil dari Viral DNA source yang sama. */
async function loadDnaFallback(
  supabase: { from: (table: string) => any },
  sourceId: string,
): Promise<DnaFallback> {
  const { data } = await supabase
    .from("viral_intelligence")
    .select("pattern_interrupt,psychological_trigger,curiosity_gap,power_words")
    .eq("source_id", sourceId)
    .maybeSingle();
  return (data ?? null) as DnaFallback;
}

export const getCarouselPrompt = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { versionId: string }) => input)
  .handler(async ({ data, context }): Promise<CarouselPromptState> => {
    const { concept } = await loadVersion(context.supabase as never, data.versionId);
    if (!concept) {
      return { status: "SELECTED_CONCEPT_REQUIRED", message: SELECTED_CONCEPT_REQUIRED_MESSAGE, record: null };
    }
    const { data: row, error } = await context.supabase
      .from("carousel_prompt_packages")
      .select("*")
      .eq("version_id", data.versionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { status: "NOT_GENERATED", message: "", record: null };
    const record = toRecord(row as unknown as Record<string, unknown>);
    return { status: record.status, message: "", record };
  });

export const generateCarouselPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { versionId: string; slideCount: 5 | 7 | 10; visualStyle: string; textLevel: CarouselTextLevel }) => input,
  )
  .handler(async ({ data, context }): Promise<CarouselPromptState> => {
    const { version, concept } = await loadVersion(context.supabase as never, data.versionId);
    if (!concept) {
      return { status: "SELECTED_CONCEPT_REQUIRED", message: SELECTED_CONCEPT_REQUIRED_MESSAGE, record: null };
    }

    const { data: existing } = await context.supabase
      .from("carousel_prompt_packages")
      .select("id,status")
      .eq("version_id", data.versionId)
      .maybeSingle();
    if (existing && (existing as { status: string }).status === "GENERATING") {
      throw new Error("Prompt Carousel sedang dibuat. Tunggu proses berjalan selesai.");
    }
    if (existing && (existing as { status: string }).status === "APPROVED_PROMPT") {
      throw new Error("Prompt Carousel sudah disetujui. Buat versi baru hanya jika konsep berubah.");
    }

    const base = {
      version_id: version.id as string,
      source_id: version.source_id as string,
      user_id: context.userId,
      slide_count: data.slideCount,
      visual_style: data.visualStyle,
      text_level: data.textLevel,
    };

    await context.supabase.from("carousel_prompt_packages").upsert(
      {
        ...base,
        status: "GENERATING" satisfies CarouselPromptStatus,
        package: {} as unknown as Json,
        slides: [] as unknown as Json,
        validation: { passed: false, issues: [], checked_at: new Date().toISOString() } as unknown as Json,
        model: "",
      },
      { onConflict: "version_id" },
    );

    try {
      const [dna, extraction, profile, products, rules, words] = await Promise.all([
        context.supabase.from("viral_intelligence").select("*").eq("source_id", version.source_id).maybeSingle(),
        context.supabase.from("source_extractions").select("source_report").eq("source_id", version.source_id).maybeSingle(),
        context.supabase.from("brand_profile").select("*").maybeSingle(),
        context.supabase.from("brand_products").select("name,description,benefit").order("created_at"),
        context.supabase.from("brand_rules").select("rule,rule_type,rule_category").order("created_at"),
        context.supabase.from("brand_power_words").select("word,context").order("created_at"),
      ]);

      const { generateCarouselPromptPackage } = await import("@/lib/carousel-prompt.server");
      const normalized = normalizeConcept(concept, (dna.data ?? null) as DnaFallback);
      const generated = await generateCarouselPromptPackage({
        slideCount: data.slideCount,
        visualStyle: data.visualStyle,
        textLevel: data.textLevel,
        concept: normalized,
        atm: {
          angle: version.angle as string,
          adaptation: version.adaptation,
          source_mapping: version.source_mapping,
          atm_mode: version.atm_mode as string,
        },
        dna: dna.data ?? null,
        sourceReport: (extraction.data as { source_report?: unknown } | null)?.source_report ?? null,
        brand: {
          profile: profile.data ?? null,
          products: products.data ?? [],
          rules: rules.data ?? [],
          power_words: words.data ?? [],
        },
      });

      const slides = generated.result.slides.map((slide, index) => ({
        ...slide,
        slide_number: index + 1,
        negative_prompt: slide.negative_prompt.includes("no text")
          ? slide.negative_prompt
          : `${slide.negative_prompt} ${NEGATIVE_PROMPT_SUFFIX}`.trim(),
      }));

      const pkg: CarouselPromptPackage = {
        ...generated.result,
        pattern_interrupt: generated.result.pattern_interrupt?.trim() || normalized.pattern_interrupt,
        psychological_trigger: generated.result.psychological_trigger?.trim() || normalized.psychological_trigger,
        curiosity_gap: generated.result.curiosity_gap?.trim() || normalized.curiosity_gap,
        power_word: generated.result.power_word?.trim() || normalized.power_words[0] || "",
        selected_hook: generated.result.selected_hook?.trim() || normalized.hook,
        slides,
        source_id: version.source_id as string,
        selected_concept_id: concept.id ?? version.id,
        analysis_version: version.source_id as string,
        ATM_version: version.id as string,
        slide_count: data.slideCount,
        visual_style: data.visualStyle,
        aspect_ratio: "4:5",
        resolution: "1080x1350",
      };

      // Validator hanya mengunci atribut yang memang tersimpan di Selected Concept.
      const validation = validateCarouselPackage(pkg, {
        hook: concept.hook,
        pattern_interrupt: concept.pattern_interrupt ?? "",
        psychological_trigger: concept.psychological_trigger ?? "",
        curiosity_gap: concept.curiosity_gap ?? "",
        power_words: concept.power_words ?? [],
      });

      const { data: saved, error: saveError } = await context.supabase
        .from("carousel_prompt_packages")
        .upsert(
          {
            ...base,
            status: (validation.passed ? "READY_FOR_REVIEW" : "NEEDS_REVISION") satisfies CarouselPromptStatus,
            package: pkg as unknown as Json,
            slides: slides as unknown as Json,
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
      await context.supabase
        .from("carousel_prompt_packages")
        .update({ status: "GENERATION_FAILED" })
        .eq("version_id", data.versionId);
      throw error instanceof Error ? error : new Error("Gagal membuat Prompt Carousel.");
    }
  });

export const saveCarouselPromptDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { versionId: string; slides: CarouselPromptSlide[] }) => input)
  .handler(async ({ data, context }): Promise<CarouselPromptState> => {
    const { version, concept } = await loadVersion(context.supabase as never, data.versionId);
    if (!concept) {
      return { status: "SELECTED_CONCEPT_REQUIRED", message: SELECTED_CONCEPT_REQUIRED_MESSAGE, record: null };
    }
    const { data: row, error } = await context.supabase
      .from("carousel_prompt_packages")
      .select("*")
      .eq("version_id", data.versionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Belum ada paket prompt untuk disimpan.");
    const current = toRecord(row as unknown as Record<string, unknown>);
    if (current.status === "APPROVED_PROMPT") throw new Error("Prompt Carousel sudah disetujui dan terkunci.");

    const slides = data.slides.map((slide, index) => ({ ...slide, slide_number: index + 1 }));
    const pkg: CarouselPromptPackage = { ...current.package, slides, slide_count: slides.length };
    const normalized = normalizeConcept(
      concept,
      await loadDnaFallback(context.supabase as never, version.source_id as string),
    );
    const validation = validateCarouselPackage(pkg, {
      hook: concept.hook,
      pattern_interrupt: concept.pattern_interrupt ?? "",
      psychological_trigger: concept.psychological_trigger ?? "",
      curiosity_gap: concept.curiosity_gap ?? "",
      power_words: concept.power_words ?? [],
    });

    const { data: saved, error: saveError } = await context.supabase
      .from("carousel_prompt_packages")
      .update({
        status: (validation.passed ? "DRAFT" : "NEEDS_REVISION") satisfies CarouselPromptStatus,
        package: pkg as unknown as Json,
        slides: slides as unknown as Json,
        validation: validation as unknown as Json,
      })
      .eq("version_id", data.versionId)
      .select("*")
      .maybeSingle();
    if (saveError) throw new Error(saveError.message);
    const record = toRecord(saved as unknown as Record<string, unknown>);
    return { status: record.status, message: "", record };
  });

export const approveCarouselPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { versionId: string }) => input)
  .handler(async ({ data, context }): Promise<CarouselPromptState> => {
    const { data: row, error } = await context.supabase
      .from("carousel_prompt_packages")
      .select("*")
      .eq("version_id", data.versionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Belum ada paket prompt untuk disetujui.");
    const current = toRecord(row as unknown as Record<string, unknown>);
    if (!current.validation?.passed) {
      throw new Error("Perbaiki seluruh catatan validator sebelum menyetujui Prompt Carousel.");
    }
    const { data: saved, error: saveError } = await context.supabase
      .from("carousel_prompt_packages")
      .update({ status: "APPROVED_PROMPT" satisfies CarouselPromptStatus, approved_at: new Date().toISOString() })
      .eq("version_id", data.versionId)
      .select("*")
      .maybeSingle();
    if (saveError) throw new Error(saveError.message);
    const record = toRecord(saved as unknown as Record<string, unknown>);
    return { status: record.status, message: "", record };
  });

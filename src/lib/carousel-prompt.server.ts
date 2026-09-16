import type { CarouselPromptPackage } from "@/lib/carousel-prompt.types";
import { NEGATIVE_PROMPT_SUFFIX } from "@/lib/carousel-prompt.types";

const MODEL = "openai/gpt-6-astra";

const TEXT = { type: "string" } as const;

const SLIDE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "slide_number", "narrative_function", "headline", "supporting_text", "key_message",
    "visual_concept", "subject", "subject_action", "facial_expression", "environment",
    "camera_shot", "composition", "lighting", "color_direction", "text_safe_area",
    "image_prompt", "negative_prompt", "layout_direction", "continuity_instruction",
    "engagement_role", "validation_status",
  ],
  properties: {
    slide_number: { type: "integer" },
    narrative_function: TEXT,
    headline: TEXT,
    supporting_text: TEXT,
    key_message: TEXT,
    visual_concept: TEXT,
    subject: TEXT,
    subject_action: TEXT,
    facial_expression: TEXT,
    environment: TEXT,
    camera_shot: TEXT,
    composition: TEXT,
    lighting: TEXT,
    color_direction: TEXT,
    text_safe_area: TEXT,
    image_prompt: TEXT,
    negative_prompt: TEXT,
    layout_direction: TEXT,
    continuity_instruction: TEXT,
    engagement_role: TEXT,
    validation_status: TEXT,
  },
} as const;

const PACKAGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "carousel_title", "selected_hook", "pattern_interrupt", "psychological_trigger",
    "curiosity_gap", "power_word", "main_problem", "main_solution", "payoff", "CTA",
    "primary_engagement_objective", "character_lock", "slides",
  ],
  properties: {
    carousel_title: TEXT,
    selected_hook: TEXT,
    pattern_interrupt: TEXT,
    psychological_trigger: TEXT,
    curiosity_gap: TEXT,
    power_word: TEXT,
    main_problem: TEXT,
    main_solution: TEXT,
    payoff: TEXT,
    CTA: TEXT,
    primary_engagement_objective: TEXT,
    character_lock: TEXT,
    slides: { type: "array", items: SLIDE_SCHEMA },
  },
} as const;

type GeneratedPackage = Omit<
  CarouselPromptPackage,
  "source_id" | "selected_concept_id" | "analysis_version" | "ATM_version" | "slide_count" | "visual_style" | "aspect_ratio" | "resolution"
>;

async function streamStructured<T>(input: {
  instructions: string;
  prompt: string;
  name: string;
  schema: Record<string, unknown>;
}): Promise<T> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("LOVABLE_API_KEY belum tersedia di server.");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: MODEL,
      instructions: input.instructions,
      input: input.prompt,
      stream: true,
      reasoning: { effort: "medium", summary: "auto" },
      text: { format: { type: "json_schema", name: input.name, strict: true, schema: input.schema } },
    }),
  });

  if (!response.ok || !response.body) {
    const raw = await response.text().catch(() => "");
    let message = raw;
    try {
      const parsed = JSON.parse(raw) as { message?: string; error?: { message?: string } };
      message = parsed.message ?? parsed.error?.message ?? raw;
    } catch {
      // keep raw gateway text
    }
    if (response.status === 401) throw new Error("Konfigurasi Lovable AI tidak valid.");
    if (response.status === 402) throw new Error(message || "Kredit AI workspace tidak mencukupi.");
    if (response.status === 403) throw new Error(message || "Lovable AI diblokir oleh kebijakan workspace.");
    if (response.status === 429) throw new Error(message || "Lovable AI sedang dibatasi. Coba lagi nanti.");
    throw new Error(message || `Lovable AI gagal (${response.status}).`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let output = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const event = JSON.parse(payload) as { type?: string; delta?: string; response?: { output_text?: string } };
        if (event.type === "response.output_text.delta" && typeof event.delta === "string") output += event.delta;
        else if (event.type === "response.completed" && event.response?.output_text && !output) output = event.response.output_text;
      } catch {
        // ignore keep-alive frames
      }
    }
  }
  if (!output.trim()) throw new Error("Lovable AI tidak mengembalikan paket prompt carousel.");
  try {
    return JSON.parse(output) as T;
  } catch {
    throw new Error("Format paket prompt tidak valid. Jalankan ulang Generate Prompt Carousel.");
  }
}

export async function generateCarouselPromptPackage(input: {
  slideCount: number;
  visualStyle: string;
  textLevel: "singkat" | "sedang" | "detail";
  concept: {
    hook: string;
    hook_type: string;
    rationale: string;
    psychological_trigger: string;
    curiosity_gap: string;
    pattern_interrupt: string;
    power_words: string[];
  };
  atm: { angle: string; adaptation: unknown; source_mapping: unknown; atm_mode: string };
  dna: unknown;
  sourceReport: unknown;
  brand: unknown;
  repairNotes?: string[];
}): Promise<{ result: GeneratedPackage; model: string }> {
  const textRule =
    input.textLevel === "singkat"
      ? "Teks pada slide sangat ringkas: headline maksimal 8 kata, supporting_text maksimal 1 kalimat pendek."
      : input.textLevel === "detail"
        ? "Teks pada slide lebih lengkap: headline maksimal 12 kata, supporting_text 2-3 kalimat padat."
        : "Teks pada slide sedang: headline maksimal 10 kata, supporting_text 1-2 kalimat.";

  const result = await streamStructured<GeneratedPackage>({
    name: "kerjaku_carousel_prompt_package",
    schema: PACKAGE_SCHEMA,
    instructions: [
      "Kamu adalah KERJAKU Output Prompt Engine untuk Text-to-Photo Carousel Instagram.",
      "Sumber utama dan tidak boleh diubah adalah Selected Concept (hook final beserta pattern interrupt, psychological trigger, curiosity gap, power words).",
      "selected_hook WAJIB sama persis dengan hook final. pattern_interrupt, psychological_trigger, curiosity_gap, dan power_word wajib konsisten dengan Selected Concept.",
      "Slide 1 wajib memvisualkan hook final; jangan mengganti hook dengan ide baru.",
      "Struktur carousel: Slide 1 hook, slide tengah problem → insight/solution → bukti/contoh, slide terakhir payoff + CTA. Isi narrative_function dengan peran slide dan tulis 'cta' pada slide penutup.",
      textRule,
      "Teks slide (headline, supporting_text, key_message) ditulis dalam Bahasa Indonesia.",
      "image_prompt WAJIB ditulis dalam Bahasa Inggris, deskriptif dan spesifik: subject, action, expression, environment, camera shot, composition, lighting, color, mood, serta ruang kosong untuk teks. Jangan meminta teks, huruf, angka, logo, atau watermark di dalam gambar.",
      `negative_prompt setiap slide wajib memuat kalimat: "${NEGATIVE_PROMPT_SUFFIX}"`,
      "character_lock menjelaskan konsistensi tokoh, wardrobe, palet warna, dan gaya visual agar seluruh slide terlihat satu rangkaian. continuity_instruction tiap slide merujuk ke character_lock.",
      "text_safe_area menjelaskan area kosong tempat teks akan ditambahkan di editor (misal 'upper third clear'). Semua gambar untuk rasio 4:5 1080x1350.",
      "validation_status diisi 'ok' bila slide sudah memenuhi aturan, atau alasan singkat bila ada risiko.",
      "Dilarang membuat caption Instagram, hashtag, storyboard video, atau menghasilkan gambar. Output hanya paket prompt teks.",
    ].join(" "),
    prompt: [
      `Jumlah slide yang diminta: ${input.slideCount} (wajib tepat ${input.slideCount} slide).`,
      `Visual style: ${input.visualStyle}`,
      `Tingkat teks: ${input.textLevel}`,
      `Selected Concept (sumber utama, tidak boleh diubah): ${JSON.stringify(input.concept)}`,
      `ATM KERJAKU: ${JSON.stringify(input.atm)}`,
      `Viral DNA Report: ${JSON.stringify(input.dna)}`,
      `Source Content Report: ${JSON.stringify(input.sourceReport)}`,
      `Brand Knowledge: ${JSON.stringify(input.brand)}`,
      ...(input.repairNotes?.length
        ? [`PERBAIKAN WAJIB — versi sebelumnya gagal validasi:\n- ${input.repairNotes.join("\n- ")}`]
        : []),
      "Hasilkan paket prompt carousel lengkap sesuai schema.",
    ].join("\n\n"),
  });

  return { result, model: MODEL };
}

import { routeStructured } from "./ai-router.server";
import type { CarouselPromptPackage } from "@/lib/carousel-prompt.types";
import { NEGATIVE_PROMPT_SUFFIX } from "@/lib/carousel-prompt.types";


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
}): Promise<{ result: T; model: string }> {
  return routeStructured<T>({ ...input, capability: "CAROUSEL" });
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

  const { result, model } = await streamStructured<GeneratedPackage>({
    name: "kerjaku_carousel_prompt_package",
    schema: PACKAGE_SCHEMA,
    instructions: [
      "Kamu adalah KERJAKU Output Prompt Engine untuk Text-to-Photo Carousel Instagram.",
      "Sumber utama dan tidak boleh diubah adalah Selected Concept (hook final beserta pattern interrupt, psychological trigger, curiosity gap, power words).",
      "selected_hook WAJIB sama persis dengan hook final. pattern_interrupt, psychological_trigger, curiosity_gap, dan power_word wajib konsisten dengan Selected Concept.",
      "Slide 1 wajib memvisualkan hook final; jangan mengganti hook dengan ide baru.",
      "Bangun satu perjalanan naratif, bukan daftar informasi: HOOK → PROBLEM RECOGNITION → INSIGHT DISCOVERY → METHOD/FRAMEWORK → APPLICATION → TRANSFORMATION/PAYOFF → CTA. Jika jumlah slide lebih dari 7, perluas tahap learning/application tanpa mengubah urutan atau konsep. Jika 5 slide, gabungkan tahap yang berdekatan tanpa menghilangkan transformation.",
      "Fungsi emosional harus berkembang: curiosity pada hook, recognition pada problem, learning pada insight/method/application, clarity pada transformation, dan action pada CTA. Setiap slide harus membuka alasan natural untuk melihat slide berikutnya.",
      "Untuk paket 7 slide, Slide 6 wajib menjadi transformation/payoff dan Slide 7 wajib CTA. Slide payoff tidak boleh sekadar merangkum solusi: tampilkan perubahan kondisi BEFORE ke AFTER setelah solusi diterapkan. Untuk topik referensi visual, gambarkan beberapa sumber referensi yang disaring menjadi satu visual decision map atau organized creative direction. Jangan membuat poster presentasi, kumpulan moodboard biasa, screenshot website, atau desain final palsu.",
      "main_problem, main_solution, payoff, dan CTA harus mengikuti Selected Concept, ATM, dan source evidence yang diberikan; jangan menciptakan masalah, solusi, payoff, atau CTA baru dari pengetahuan luar.",
      textRule,
      "Teks slide (headline, supporting_text, key_message) ditulis dalam Bahasa Indonesia.",
      "image_prompt WAJIB ditulis dalam Bahasa Inggris dengan urutan makna: SUBJECT + ACTION + NARRATIVE PURPOSE + ENVIRONMENT + CAMERA + COMPOSITION + LIGHTING + TEXT SAFE AREA + CONTINUITY. Jelaskan tujuan visual slide, hubungannya dengan visual slide sebelumnya (kecuali Slide 1), dan kontribusinya pada perjalanan narasi. Jangan hanya mendeskripsikan objek.",
      "Variasikan aksi karakter sesuai fungsi slide: menjelaskan masalah, menunjukkan kebingungan, menganalisis referensi, mengatur proses, memilih komponen, melihat hasil sistem, lalu melakukan CTA. Jangan mengulang pose duduk, memegang papan, atau melihat kamera di semua slide.",
      `negative_prompt setiap slide wajib memuat kalimat: "${NEGATIVE_PROMPT_SUFFIX}"`,
      "character_lock menjelaskan konsistensi tokoh, wardrobe, palet warna, dan gaya visual agar seluruh slide terlihat satu rangkaian. continuity_instruction tiap slide merujuk ke character_lock.",
      "Pertahankan karakter, pakaian, lokasi, warna, lighting, dan visual style pada semua slide. Ubah aksi dan framing secara progresif agar visual terasa sebagai satu cerita, bukan tujuh gambar terpisah.",
      "text_safe_area menjelaskan area kosong tempat teks akan ditambahkan di editor (misal 'upper third clear'). Semua gambar untuk rasio 4:5 1080x1350.",
      "validation_status diisi 'ok' bila slide sudah memenuhi aturan, atau alasan singkat bila ada risiko.",
      "CTA wajib spesifik mengikuti primary_engagement_objective: save meminta menyimpan framework sebelum langkah berikutnya, share menyebut orang yang relevan untuk menerima konten, comment memberi pertanyaan konkret. Hindari CTA generik seperti 'Simpan rangkuman ini'.",
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

  return { result, model };
}

import { routeStructured } from "./ai-router.server";
import type { BrandKnowledgeInput, ViralDnaResult } from "@/lib/cliper-intelligence.server";

export type ProductionSourceRef = {
  origin: "source_content_report" | "brand_knowledge";
  detail: string;
  timestamp: string;
};

export type CarouselSlide = {
  slide_number: number;
  objective: string;
  headline: string;
  body_text: string;
  visual_direction: string;
  cta: string;
  source_refs: ProductionSourceRef[];
  hook: string;
  pattern_interrupt: string;
  psychological_trigger: string;
  curiosity_gap: string;
  power_words: string[];
};

export type VisualPrompt = {
  slide_number: number;
  scene_description: string;
  visual_style: string;
  composition: string;
  camera_angle: string;
  lighting: string;
  mood: string;
  aspect_ratio: string;
  text_in_image: string;
  negative_prompt: string;
};

export type CaptionOption = {
  caption_angle: string;
  hook: string;
  body: string;
  cta: string;
  hashtag: string;
  char_count: number;
};

export type CtaOption = { cta_type: "comment" | "save" | "share" | "discussion"; cta_text: string };

export type HashtagSet = { broad: string[]; niche: string[]; brand: string[] };

export type ContentInfo = {
  title: string;
  content_angle: string;
  target_audience: string;
  objective: string;
};

export type ProductionResult = {
  content_info: ContentInfo;
  carousel_structure: CarouselSlide[];
  visual_prompts: VisualPrompt[];
  caption_options: CaptionOption[];
  cta_options: CtaOption[];
  hashtags: HashtagSet;
};


const SOURCE_REF_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["origin", "detail", "timestamp"],
  properties: {
    origin: { type: "string", enum: ["source_content_report", "brand_knowledge"] },
    detail: { type: "string" },
    timestamp: { type: "string" },
  },
} as const;

const PRODUCTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["content_info", "carousel_structure", "visual_prompts", "caption_options", "cta_options", "hashtags"],
  properties: {
    content_info: {
      type: "object",
      additionalProperties: false,
      required: ["title", "content_angle", "target_audience", "objective"],
      properties: {
        title: { type: "string" },
        content_angle: { type: "string" },
        target_audience: { type: "string" },
        objective: { type: "string" },
      },
    },
    carousel_structure: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "slide_number", "objective", "headline", "body_text", "visual_direction", "cta",
          "source_refs", "hook", "pattern_interrupt", "psychological_trigger", "curiosity_gap", "power_words",
        ],
        properties: {
          slide_number: { type: "integer" },
          objective: { type: "string" },
          headline: { type: "string" },
          body_text: { type: "string" },
          visual_direction: { type: "string" },
          cta: { type: "string" },
          source_refs: { type: "array", items: SOURCE_REF_SCHEMA },
          hook: { type: "string" },
          pattern_interrupt: { type: "string" },
          psychological_trigger: { type: "string" },
          curiosity_gap: { type: "string" },
          power_words: { type: "array", items: { type: "string" } },
        },
      },
    },
    visual_prompts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "slide_number", "scene_description", "visual_style", "composition", "camera_angle",
          "lighting", "mood", "aspect_ratio", "text_in_image", "negative_prompt",
        ],
        properties: {
          slide_number: { type: "integer" },
          scene_description: { type: "string" },
          visual_style: { type: "string" },
          composition: { type: "string" },
          camera_angle: { type: "string" },
          lighting: { type: "string" },
          mood: { type: "string" },
          aspect_ratio: { type: "string" },
          text_in_image: { type: "string" },
          negative_prompt: { type: "string" },
        },
      },
    },
    caption_options: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["caption_angle", "hook", "body", "cta", "hashtag", "char_count"],
        properties: {
          caption_angle: {
            type: "string",
            enum: ["educational", "curiosity", "storytelling", "controversial", "practical"],
          },
          hook: { type: "string" },
          body: { type: "string" },
          cta: { type: "string" },
          hashtag: { type: "string" },
          char_count: { type: "integer" },
        },
      },
    },
    cta_options: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["cta_type", "cta_text"],
        properties: {
          cta_type: { type: "string", enum: ["comment", "save", "share", "discussion"] },
          cta_text: { type: "string" },
        },
      },
    },
    hashtags: {
      type: "object",
      additionalProperties: false,
      required: ["broad", "niche", "brand"],
      properties: {
        broad: { type: "array", items: { type: "string" } },
        niche: { type: "array", items: { type: "string" } },
        brand: { type: "array", items: { type: "string" } },
      },
    },
  },
} as const;

async function streamStructured<T>(input: {
  instructions: string;
  prompt: string;
  name: string;
  schema: Record<string, unknown>;
}): Promise<{ result: T; model: string }> {
  return routeStructured<T>({ ...input, capability: "SCRIPT_GENERATION" });
}

export async function generateContentProduction(input: {
  mode: "conservative" | "creative";
  angle: string;
  dna: ViralDnaResult;
  sourceReport: unknown;
  sourceMapping: unknown;
  adaptation: unknown;
  brand: BrandKnowledgeInput;
  /** Catatan kegagalan Quality Gate untuk satu kali perbaikan otomatis. */
  repairNotes?: string[];
}): Promise<{ result: ProductionResult; model: string }> {
  const factRule =
    input.mode === "conservative"
      ? "Mode Conservative: SELURUH fakta, angka, contoh, dan klaim hanya boleh berasal dari Source Content Report. Dilarang memakai fakta dari Brand Knowledge sebagai informasi baru; Brand Knowledge hanya menentukan gaya bahasa."
      : "Mode Creative: fakta hanya boleh berasal dari Source Content Report atau Brand Knowledge. Dilarang mengarang data, statistik, testimoni, atau klaim produk di luar kedua sumber itu.";

  const { result, model } = await streamStructured<ProductionResult>({
    name: "kerjaku_content_production",
    schema: PRODUCTION_SCHEMA,
    instructions: [
      "Kamu adalah KERJAKU Content Production Engine. Kamu mengubah KERJAKU Version Report menjadi aset konten siap produksi untuk Instagram.",
      factRule,
      "Setiap slide carousel WAJIB memiliki source_refs yang menyebut asal informasi (source_content_report atau brand_knowledge) dan detail rujukannya; gunakan timestamp sumber bila berasal dari Source Content Report, isi '-' bila dari Brand Knowledge.",
      "Jumlah slide fleksibel mengikuti kebutuhan cerita (biasanya 5-10). Jangan memaksa jumlah tertentu.",
      "Slide pertama wajib memiliki hook, pattern_interrupt, psychological_trigger, curiosity_gap, dan power_words yang kuat agar menghentikan scroll. Slide lain boleh mengisi field itu dengan string kosong atau array kosong bila tidak relevan.",
      "Visual prompt harus konsisten dengan identitas brand, mendukung storytelling, tidak acak. Default aspect_ratio '9:16'. Isi text_in_image dengan 'none' kecuali teks benar-benar dibutuhkan di dalam gambar, karena teks utama ditambahkan lewat editor.",
      "Buat tepat 5 opsi caption dengan pendekatan berbeda (educational, curiosity, storytelling, controversial, practical) — bukan parafrase satu sama lain. char_count adalah jumlah karakter perkiraan hook+body+cta.",
      "Buat CTA untuk kategori comment, save, share, dan discussion.",
      "Hashtag dibagi menjadi broad, niche, dan brand sesuai topik, audience, industri, dan positioning KERJAKU. Selalu diawali tanda pagar.",
      "Jangan membuat storyboard video, photo-to-video, atau rencana editing video. Jawab dalam Bahasa Indonesia.",
    ].join(" "),
    prompt: [
      `ATM Mode: ${input.mode}`,
      `Angle disetujui: ${input.angle}`,
      `KERJAKU Version Report (adaptation): ${JSON.stringify(input.adaptation)}`,
      `Source Mapping: ${JSON.stringify(input.sourceMapping)}`,
      `Viral DNA Report: ${JSON.stringify(input.dna)}`,
      `Source Content Report: ${JSON.stringify(input.sourceReport)}`,
      `Brand Knowledge: ${JSON.stringify(input.brand)}`,
      ...(input.repairNotes && input.repairNotes.length > 0
        ? [
            `PERBAIKAN WAJIB — versi sebelumnya gagal Quality Gate karena hal berikut. Perbaiki seluruhnya tanpa melanggar aturan sumber fakta:\n- ${input.repairNotes.join(
              "\n- ",
            )}`,
          ]
        : []),
      "Hasilkan Carousel Content Report, Image Prompt Report, 5 caption, CTA strategy, dan hashtag set.",
    ].join("\n\n"),
  });

  return { result, model };
}

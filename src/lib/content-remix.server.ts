import { routeStructured } from "./ai-router.server";
export type RemixSlide = { slide_number: number; purpose: string; text: string };
export type RemixCaption = { style: string; text: string };
export type RemixCta = { type: string; text: string };

export type ContentRemixResult = {
  content_angle: string;
  angle_rationale: string;
  structure_type: string;
  content_type: "carousel" | "photo_to_video" | "video_content";
  slides: RemixSlide[];
  captions: RemixCaption[];
  hashtags: string[];
  ctas: RemixCta[];
  quality_check: {
    pattern_interrupt: string;
    psychological_trigger: string;
    curiosity_gap: string;
    power_word: string;
  };
};

const SYSTEM_PROMPT = `Kamu adalah content strategist & copywriter untuk brand @kerjaku.space (konten karier, dunia kerja, dan pengembangan diri untuk audiens Indonesia).

Tugasmu: mengubah HASIL ANALISIS konten viral menjadi KONTEN ORISINAL versi KERJAKU.
Prinsip ATM: Amati, Tiru KONSEP-nya, Modifikasi total eksekusinya.

Larangan keras:
- Jangan menyalin caption, naskah, atau visual konten asli.
- Jangan sekadar parafrase kalimat asli.

Aturan struktur:
- Struktur konten FLEKSIBEL. Pilih sendiri yang paling cocok: storytelling, edukasi, studi kasus, listicle, mitos vs fakta, atau lainnya. Sebutkan pilihanmu di structure_type.
- Jumlah slide bebas (4-10) sesuai kebutuhan. Setiap slide punya slide_number, purpose (contoh: Hook, Konflik, Insight, Bukti, Solusi, CTA), dan text siap pakai.

Aturan kualitas — setiap konten WAJIB lolos:
1. Pattern Interrupt (slide pertama menghentikan scroll)
2. Psychological Trigger (Curiosity / Fear / Relatability / Authority / Aspiration / Debate)
3. Curiosity Gap
4. Power Word
Jelaskan pemenuhan tiap poin di quality_check.

Output lain:
- captions: TEPAT 5 opsi caption berbeda gaya (misal: storytelling, to the point, provokatif, edukatif, personal).
- hashtags: 12-20 hashtag relevan tanpa spasi, diawali #.
- ctas: 4 CTA, masing-masing bertipe Comment, Save, Share, dan Discussion.

Semua output dalam Bahasa Indonesia yang natural, konkret, dan siap posting.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "content_angle",
    "angle_rationale",
    "structure_type",
    "content_type",
    "slides",
    "captions",
    "hashtags",
    "ctas",
    "quality_check",
  ],
  properties: {
    content_angle: { type: "string" },
    angle_rationale: { type: "string" },
    structure_type: { type: "string" },
    content_type: { type: "string", enum: ["carousel", "photo_to_video", "video_content"] },
    slides: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["slide_number", "purpose", "text"],
        properties: {
          slide_number: { type: "integer" },
          purpose: { type: "string" },
          text: { type: "string" },
        },
      },
    },
    captions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["style", "text"],
        properties: { style: { type: "string" }, text: { type: "string" } },
      },
    },
    hashtags: { type: "array", items: { type: "string" } },
    ctas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "text"],
        properties: { type: { type: "string" }, text: { type: "string" } },
      },
    },
    quality_check: {
      type: "object",
      additionalProperties: false,
      required: ["pattern_interrupt", "psychological_trigger", "curiosity_gap", "power_word"],
      properties: {
        pattern_interrupt: { type: "string" },
        psychological_trigger: { type: "string" },
        curiosity_gap: { type: "string" },
        power_word: { type: "string" },
      },
    },
  },
} as const;

export async function generateContentRemix(input: {
  title: string;
  category: string | null;
  platform: string;
  analysis: Record<string, string>;
  preferredType?: string | null;
  notes?: string | null;
}): Promise<{ result: ContentRemixResult; model: string }> {
  const analysisLines = Object.entries(input.analysis)
    .filter(([, v]) => typeof v === "string" && v.trim())
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");

  const prompt = [
    `Judul referensi viral: ${input.title}`,
    `Platform: ${input.platform}`,
    `Kategori: ${input.category ?? "tidak ditentukan"}`,
    input.preferredType ? `Format konten yang diinginkan: ${input.preferredType}` : "",
    input.notes ? `Catatan tambahan: ${input.notes}` : "",
    "",
    "HASIL ANALISIS VIRAL:",
    analysisLines,
    "",
    "Buat versi konten ORISINAL KERJAKU berdasarkan formula di atas (bukan tiruan konten asli).",
  ]
    .filter(Boolean)
    .join("\n");

  const { result: parsed, model } = await routeStructured<ContentRemixResult>({
    capability: "CONTENT_REMIX", instructions: SYSTEM_PROMPT, prompt,
    name: "content_remix", schema: SCHEMA,
  });

  const result: ContentRemixResult = {
    content_angle: parsed.content_angle ?? "",
    angle_rationale: parsed.angle_rationale ?? "",
    structure_type: parsed.structure_type ?? "",
    content_type: parsed.content_type ?? "carousel",
    slides: Array.isArray(parsed.slides)
      ? parsed.slides.map((s, i) => ({
          slide_number: Number(s.slide_number) || i + 1,
          purpose: String(s.purpose ?? ""),
          text: String(s.text ?? ""),
        }))
      : [],
    captions: Array.isArray(parsed.captions) ? parsed.captions.slice(0, 5) : [],
    hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.filter(Boolean) : [],
    ctas: Array.isArray(parsed.ctas) ? parsed.ctas : [],
    quality_check: parsed.quality_check ?? {
      pattern_interrupt: "",
      psychological_trigger: "",
      curiosity_gap: "",
      power_word: "",
    },
  };

  return { result, model };
}

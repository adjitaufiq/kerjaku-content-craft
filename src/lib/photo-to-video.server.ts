import type { CarouselPromptPackage, CarouselPromptSlide } from "@/lib/carousel-prompt.types";
import { VIDEO_NEGATIVE_PROMPT, type PhotoToVideoPackage } from "@/lib/photo-to-video.types";

const MODEL = "openai/gpt-6-astra";

const TEXT = { type: "string" } as const;

const SCENE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "scene_number", "source_carousel_slide", "narrative_function", "duration_seconds",
    "original_carousel_visual", "visual_concept", "primary_subject_motion", "secondary_motion",
    "camera_motion", "environment_motion", "ending_frame", "photo_to_video_prompt",
    "video_negative_prompt",
  ],
  properties: {
    scene_number: { type: "integer" },
    source_carousel_slide: { type: "integer" },
    narrative_function: TEXT,
    duration_seconds: { type: "integer", enum: [4, 6, 8, 10] },
    original_carousel_visual: TEXT,
    visual_concept: TEXT,
    primary_subject_motion: TEXT,
    secondary_motion: TEXT,
    camera_motion: TEXT,
    environment_motion: TEXT,
    ending_frame: TEXT,
    photo_to_video_prompt: TEXT,
    video_negative_prompt: TEXT,
  },
} as const;

const PACKAGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "video_title", "selected_hook", "main_problem", "main_solution", "payoff", "CTA",
    "primary_engagement_objective", "character_lock", "product_lock", "environment_lock",
    "visual_style", "scenes",
  ],
  properties: {
    video_title: TEXT,
    selected_hook: TEXT,
    main_problem: TEXT,
    main_solution: TEXT,
    payoff: TEXT,
    CTA: TEXT,
    primary_engagement_objective: TEXT,
    character_lock: TEXT,
    product_lock: TEXT,
    environment_lock: TEXT,
    visual_style: TEXT,
    scenes: { type: "array", items: SCENE_SCHEMA },
  },
} as const;

export type GeneratedVideoPackage = Omit<
  PhotoToVideoPackage,
  "version_id" | "source_id" | "aspect_ratio" | "resolution"
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
        else if (event.type === "response.completed" && event.response?.output_text && !output)
          output = event.response.output_text;
      } catch {
        // ignore keep-alive frames
      }
    }
  }
  if (!output.trim()) throw new Error("Lovable AI tidak mengembalikan paket prompt video.");
  try {
    return JSON.parse(output) as T;
  } catch {
    throw new Error("Format paket prompt video tidak valid. Jalankan ulang Generate Photo-to-Video.");
  }
}

export async function generatePhotoToVideoPackage(input: {
  defaultDuration: 4 | 6 | 8 | 10;
  carousel: CarouselPromptPackage;
  slides: CarouselPromptSlide[];
  concept: unknown;
}): Promise<{ result: GeneratedVideoPackage; model: string }> {
  const result = await streamStructured<GeneratedVideoPackage>({
    name: "kerjaku_photo_to_video_package",
    schema: PACKAGE_SCHEMA,
    instructions: [
      "Kamu adalah KERJAKU Photo-to-Video Prompt Engine.",
      "Tugasmu hanya mengubah visual carousel KERJAKU yang SUDAH ADA menjadi prompt animasi video pendek. Visual carousel adalah frame awal video.",
      "Dilarang membuat konsep baru, hook baru, masalah baru, solusi baru, CTA baru, cerita baru, atau menambah informasi di luar Prompt Carousel dan Selected Concept.",
      "selected_hook, main_problem, main_solution, payoff, CTA, dan primary_engagement_objective WAJIB disalin apa adanya dari Prompt Carousel.",
      "Setiap slide carousel menjadi tepat satu scene video, urut sesuai slide_number. Jumlah scene wajib sama dengan jumlah slide.",
      "duration_seconds hanya boleh 4, 6, 8, atau 10 detik. Jangan pernah memakai 5, 7, 15, atau 30 detik.",
      "Setiap scene hanya boleh punya SATU primary subject movement (contoh: membuka tangan, menunjuk objek, mengambil produk, melihat kamera, berjalan perlahan) dan SATU camera movement (slow push in, gentle pan, subtle zoom, camera tracking). Environment movement harus halus (cahaya alami bergerak, gerakan tangan kecil, gerakan latar tipis).",
      "Dilarang gerakan berlebihan, cinematic action yang tidak sesuai, perpindahan lokasi, atau perubahan karakter.",
      "character_lock, product_lock, dan environment_lock wajib menjaga wajah, umur, rambut, pakaian, ekspresi, bentuk/warna/ukuran produk, lokasi, lighting, dan warna tetap sama di semua scene. Visual style tetap realistic editorial KERJAKU.",
      "original_carousel_visual merangkum visual carousel slide asal (dari image_prompt dan visual_concept). visual_concept mengikuti slide yang sama.",
      "photo_to_video_prompt WAJIB Bahasa Inggris dan memakai format persis berikut, baris demi baris:",
      [
        "Animate this existing KERJAKU carousel visual into a realistic vertical video.",
        "",
        "Duration:",
        "[X seconds]",
        "",
        "Preserve the exact:",
        "- character identity;",
        "- face;",
        "- clothing;",
        "- product;",
        "- environment;",
        "- color palette;",
        "- lighting;",
        "- visual style.",
        "",
        "Motion:",
        "",
        "Primary subject movement:",
        "[one clear movement]",
        "",
        "Camera movement:",
        "[one camera movement]",
        "",
        "Secondary environment movement:",
        "[subtle movement]",
        "",
        "Maintain realistic physics and natural motion.",
        "",
        "Ending frame:",
        "[describe final position]",
        "",
        "Vertical 9:16 video.",
        "",
        "No text.",
        "No logo.",
        "No watermark.",
      ].join("\n"),
      `video_negative_prompt setiap scene wajib persis: "${VIDEO_NEGATIVE_PROMPT}"`,
      "Output hanya prompt teks. Dilarang membuat file video, rendering, storyboard baru, caption, atau hashtag.",
    ].join(" "),
    prompt: [
      `Durasi default yang diminta user: ${input.defaultDuration} detik (boleh disesuaikan per scene hanya ke 4/6/8/10 detik bila fungsi naratif menuntut).`,
      `Selected Concept (terkunci): ${JSON.stringify(input.concept)}`,
      `Prompt Carousel package (terkunci): ${JSON.stringify({
        carousel_title: input.carousel.carousel_title,
        selected_hook: input.carousel.selected_hook,
        main_problem: input.carousel.main_problem,
        main_solution: input.carousel.main_solution,
        payoff: input.carousel.payoff,
        CTA: input.carousel.CTA,
        primary_engagement_objective: input.carousel.primary_engagement_objective,
        character_lock: input.carousel.character_lock,
        visual_style: input.carousel.visual_style,
      })}`,
      `Carousel visual per slide: ${JSON.stringify(
        input.slides.map((slide) => ({
          slide_number: slide.slide_number,
          headline: slide.headline,
          narrative_function: slide.narrative_function,
          visual_concept: slide.visual_concept,
          image_prompt: slide.image_prompt,
          character_direction: `${slide.subject} — ${slide.subject_action} — ${slide.facial_expression}`,
          environment_direction: slide.environment,
          color_direction: slide.color_direction,
          continuity_instruction: slide.continuity_instruction,
        })),
      )}`,
      "Hasilkan paket photo-to-video lengkap sesuai schema.",
    ].join("\n\n"),
  });

  return { result, model: MODEL };
}

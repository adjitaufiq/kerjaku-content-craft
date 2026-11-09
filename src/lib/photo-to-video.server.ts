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
    "camera_motion", "environment_motion", "vo_synchronization", "ending_frame", "photo_to_video_prompt",
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
    vo_synchronization: TEXT,
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
  canvaNotes?: Record<number, string>;
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
      "Untuk setiap scene, perlakukan image_prompt sebagai Original Image Prompt, gabungan headline + supporting_text + key_message sebagai Voice Over (VO), dan narrative_function sebagai Slide Purpose / Story Position.",
      "Analisis fase cerita dari narrative_function: PROBLEM memperkuat ketidakpastian, pencarian, perbandingan, atau keraguan; SOLUTION memperkuat kejelasan, tindakan, interaksi, atau progres; RESULT/PAYOFF memperkuat keyakinan, reveal, completion, atau satisfaction; CTA menjaga pesan ajakan tanpa membuat adegan atau klaim baru.",
      "Setiap scene hanya boleh punya SATU primary subject movement yang realistis dan minimal serta SATU camera movement yang sesuai emosi VO. Pilih hanya dari slow push in, smooth dolly movement, gentle camera pan, subtle zoom, depth parallax, atau focus transition. Environment movement harus halus.",
      "Dilarang gerakan berlebihan, cinematic action yang tidak sesuai, perpindahan lokasi, atau perubahan karakter.",
      "character_lock, product_lock, dan environment_lock wajib menjaga identitas karakter, wajah, pakaian, lingkungan, objek, color palette, lighting style, dan komposisi asli tetap sama. Gambar harus terlihat hidup secara alami, bukan didesain ulang.",
      "Motion style wajib premium editorial video, modern brand storytelling, professional social media content, cinematic realistic movement, intensitas subtle to medium, dan realism over effects.",
      "Bila final_canva_visual terisi, itu adalah deskripsi gambar FINAL yang user buat di Canva dan WAJIB menjadi acuan utama visual (mengalahkan image_prompt): gerakan kamera, subjek, dan lingkungan harus sesuai elemen yang benar-benar ada di gambar Canva tersebut. Jangan menganimasikan teks/grafis Canva menjadi bentuk lain; teks dan layout tetap diam dan terbaca.",
      "original_carousel_visual merangkum visual carousel slide asal (dari image_prompt dan visual_concept). visual_concept mengikuti slide yang sama.",
      "vo_synchronization WAJIB menjelaskan gerak yang mendukung makna VO tanpa mengubah konsep. ending_frame mempertahankan komposisi asli, elemen penting terlihat, dan menyiapkan transisi lembut ke scene berikutnya.",
      "photo_to_video_prompt WAJIB hanya berisi prompt final berbahasa Inggris yang siap ditempel ke Google Flow, Runway, Kling, Luma, atau generator video lain. Gunakan format persis berikut:",
      [
        "Animate the existing generated image naturally into a cinematic realistic vertical video. Do not create or redesign the image.",
        "",
        "Duration: [X seconds]. Vertical 9:16 video.",
        "",
        "Camera movement:",
        "[one cinematic camera movement matched to the VO emotion]",
        "",
        "Subject movement:",
        "[one realistic minimal movement of the existing subject]",
        "",
        "Environment movement:",
        "[subtle environmental motion only]",
        "",
        "VO synchronization:",
        "[movement alignment with the problem, solution, result, or CTA phase]",
        "",
        "Ending frame:",
        "[final position preserving composition and preparing a smooth transition]",
        "",
        "Visual consistency:",
        "Preserve the same character identity, face, clothing, environment, objects, color palette, lighting style, and same composition. Keep all important visual elements visible. Maintain realistic physics and natural motion.",
        "",
        "Motion style:",
        "Premium editorial video, modern brand storytelling, professional social media content, cinematic realistic movement, subtle to medium intensity, realism over effects, in a single continuous shot with no scene cuts.",
        "",
        "Negative prompt:",
        VIDEO_NEGATIVE_PROMPT,
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
           voice_over: [slide.headline, slide.supporting_text, slide.key_message].filter(Boolean).join(" — "),
           slide_purpose: slide.narrative_function,
          narrative_function: slide.narrative_function,
          visual_concept: slide.visual_concept,
          image_prompt: slide.image_prompt,
          character_direction: `${slide.subject} — ${slide.subject_action} — ${slide.facial_expression}`,
          environment_direction: slide.environment,
          color_direction: slide.color_direction,
          continuity_instruction: slide.continuity_instruction,
          final_canva_visual: input.canvaNotes?.[slide.slide_number]?.trim() || null,
        })),
      )}`,
      "Hasilkan paket photo-to-video lengkap sesuai schema.",
    ].join("\n\n"),
  });

  return { result, model: MODEL };
}

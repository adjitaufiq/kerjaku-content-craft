import { routeStructured } from "./ai-router.server";
import type { BrandKnowledgeInput } from "@/lib/cliper-intelligence.server";
import type { CarouselSlide, ContentInfo, VisualPrompt } from "@/lib/content-production.server";

export const ALLOWED_SCENE_DURATIONS = [4, 6, 8, 10] as const;
export type SceneDuration = (typeof ALLOWED_SCENE_DURATIONS)[number];

export type StoryboardScene = {
  scene_number: number;
  scene_role: string;
  duration_seconds: SceneDuration;
  source_slide_number: number;
  narrative: string;
  camera_movement: string;
  subject_motion: string;
  background_motion: string;
  transition_in: string;
  transition_out: string;
  audio_direction: string;
  on_screen_text: string;
  video_prompt: string;
  negative_prompt: string;
  consistency_lock: string;
};

export type VideoConcept = {
  title: string;
  story_arc: string;
  visual_identity: string;
  character_lock: string;
  brand_lock: string;
  aspect_ratio: string;
  pacing: string;
};

export type VideoPackage = {
  scene_order: number[];
  total_duration: number;
  merge_notes: string;
  music_direction: string;
  caption_overlay_plan: string;
};

export type StoryboardResult = {
  video_concept: VideoConcept;
  scenes: StoryboardScene[];
  video_package: VideoPackage;
};


const STORYBOARD_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["video_concept", "scenes", "video_package"],
  properties: {
    video_concept: {
      type: "object",
      additionalProperties: false,
      required: ["title", "story_arc", "visual_identity", "character_lock", "brand_lock", "aspect_ratio", "pacing"],
      properties: {
        title: { type: "string" },
        story_arc: { type: "string" },
        visual_identity: { type: "string" },
        character_lock: { type: "string" },
        brand_lock: { type: "string" },
        aspect_ratio: { type: "string" },
        pacing: { type: "string" },
      },
    },
    scenes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "scene_number", "scene_role", "duration_seconds", "source_slide_number", "narrative",
          "camera_movement", "subject_motion", "background_motion", "transition_in", "transition_out",
          "audio_direction", "on_screen_text", "video_prompt", "negative_prompt", "consistency_lock",
        ],
        properties: {
          scene_number: { type: "integer" },
          scene_role: { type: "string" },
          duration_seconds: { type: "integer", enum: [4, 6, 8, 10] },
          source_slide_number: { type: "integer" },
          narrative: { type: "string" },
          camera_movement: { type: "string" },
          subject_motion: { type: "string" },
          background_motion: { type: "string" },
          transition_in: { type: "string" },
          transition_out: { type: "string" },
          audio_direction: { type: "string" },
          on_screen_text: { type: "string" },
          video_prompt: { type: "string" },
          negative_prompt: { type: "string" },
          consistency_lock: { type: "string" },
        },
      },
    },
    video_package: {
      type: "object",
      additionalProperties: false,
      required: ["scene_order", "total_duration", "merge_notes", "music_direction", "caption_overlay_plan"],
      properties: {
        scene_order: { type: "array", items: { type: "integer" } },
        total_duration: { type: "integer" },
        merge_notes: { type: "string" },
        music_direction: { type: "string" },
        caption_overlay_plan: { type: "string" },
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
  return routeStructured<T>({ ...input, capability: "STORYBOARD" });
}

function normalizeDuration(value: number): SceneDuration {
  const allowed = ALLOWED_SCENE_DURATIONS as readonly number[];
  if (allowed.includes(value)) return value as SceneDuration;
  let closest: SceneDuration = 4;
  for (const option of ALLOWED_SCENE_DURATIONS) {
    if (Math.abs(option - value) < Math.abs(closest - value)) closest = option;
  }
  return closest;
}

export function normalizeStoryboard(result: StoryboardResult): StoryboardResult {
  const scenes = (result.scenes ?? [])
    .slice()
    .sort((a, b) => a.scene_number - b.scene_number)
    .map((scene, index) => ({
      ...scene,
      scene_number: index + 1,
      duration_seconds: normalizeDuration(Number(scene.duration_seconds)),
    }));
  const total = scenes.reduce((sum, scene) => sum + scene.duration_seconds, 0);
  return {
    video_concept: result.video_concept,
    scenes,
    video_package: {
      ...result.video_package,
      scene_order: scenes.map((scene) => scene.scene_number),
      total_duration: total,
    },
  };
}

export async function generateVideoStoryboard(input: {
  mode: "conservative" | "creative";
  angle: string;
  contentInfo: ContentInfo;
  carousel: CarouselSlide[];
  visualPrompts: VisualPrompt[];
  brand: BrandKnowledgeInput;
}): Promise<{ result: StoryboardResult; model: string }> {
  const factRule =
    input.mode === "conservative"
      ? "Mode Conservative: seluruh fakta dan klaim hanya boleh berasal dari aset Content Production yang diberikan. Dilarang menambah informasi baru."
      : "Mode Creative: fakta hanya boleh berasal dari aset Content Production atau Brand Knowledge. Dilarang mengarang data atau klaim baru.";

  const { result: raw, model } = await streamStructured<StoryboardResult>({
    name: "kerjaku_video_storyboard",
    schema: STORYBOARD_SCHEMA,
    instructions: [
      "Kamu adalah KERJAKU Photo To Video Storyboard Engine. Kamu mengubah aset gambar carousel menjadi storyboard video pendek vertikal.",
      factRule,
      "Setiap scene dibangun dari satu slide carousel yang sudah ada; isi source_slide_number dengan nomor slide asalnya.",
      "duration_seconds WAJIB salah satu dari 4, 6, 8, atau 10 detik. Tidak boleh nilai lain.",
      "Jumlah scene fleksibel mengikuti kebutuhan cerita (biasanya 4-8) dan total durasi ideal 20-60 detik.",
      "video_prompt harus siap dipakai pada AI image-to-video: jelaskan gerak subjek, gerak kamera, kedalaman, pencahayaan, ritme, dan suasana. Jangan menulis instruksi editing software.",
      "consistency_lock menjaga karakter, wardrobe, palet warna, dan identitas brand tetap sama antar scene.",
      "Default aspect ratio 9:16. on_screen_text singkat; isi 'none' bila tidak dibutuhkan.",
      "Jangan membuat rencana rendering, merge otomatis, atau editing otomatis. Jawab dalam Bahasa Indonesia.",
    ].join(" "),
    prompt: [
      `ATM Mode: ${input.mode}`,
      `Angle disetujui: ${input.angle}`,
      `Content Information: ${JSON.stringify(input.contentInfo)}`,
      `Carousel Structure: ${JSON.stringify(input.carousel)}`,
      `Image Prompt Report: ${JSON.stringify(input.visualPrompts)}`,
      `Brand Knowledge: ${JSON.stringify(input.brand)}`,
      "Hasilkan Video Concept, daftar scene bertimeline, dan Video Package untuk modul Video Composer berikutnya.",
    ].join("\n\n"),
  });

  return { result: normalizeStoryboard(raw), model };
}

/** Tipe bersama Photo-to-Video Prompt (aman untuk client & server). */

export type PhotoToVideoStatus =
  | "NOT_GENERATED"
  | "GENERATING"
  | "DRAFT"
  | "NEEDS_REVISION"
  | "READY_FOR_REVIEW"
  | "APPROVED_VIDEO_PROMPT"
  | "GENERATION_FAILED";

export type VideoDuration = 4 | 6 | 8 | 10;

export const VIDEO_DURATIONS: VideoDuration[] = [4, 6, 8, 10];

export const VIDEO_NEGATIVE_PROMPT =
  "No text, no subtitles, no watermark, no logo, no face change, no identity change, no clothing change, no product deformation, no extra fingers, no distorted hands, no unrealistic movement, no changing environment, no camera shake, no visual style change, no artificial looking motion.";

export type PhotoToVideoScene = {
  scene_number: number;
  source_carousel_slide: number;
  narrative_function: string;
  duration_seconds: VideoDuration;

  original_carousel_visual: string;
  visual_concept: string;

  primary_subject_motion: string;
  secondary_motion: string;
  camera_motion: string;
  environment_motion: string;

  ending_frame: string;
  photo_to_video_prompt: string;
  video_negative_prompt: string;
};

export type PhotoToVideoPackage = {
  video_title: string;
  version_id: string;
  source_id: string;
  selected_hook: string;
  main_problem: string;
  main_solution: string;
  payoff: string;
  CTA: string;
  primary_engagement_objective: string;
  character_lock: string;
  product_lock: string;
  environment_lock: string;
  visual_style: string;
  aspect_ratio: "9:16";
  resolution: "1080x1920";
  scenes: PhotoToVideoScene[];
};

export type PhotoToVideoIssue = {
  failed_rule: string;
  affected_scene: number | null;
  reason: string;
};

export type PhotoToVideoValidation = {
  passed: boolean;
  issues: PhotoToVideoIssue[];
  checked_at: string;
};

export type PhotoToVideoRecord = {
  id: string;
  version_id: string;
  source_id: string;
  status: PhotoToVideoStatus;
  default_duration: VideoDuration;
  scene_count: number;
  package: PhotoToVideoPackage;
  scenes: PhotoToVideoScene[];
  validation: PhotoToVideoValidation;
  model: string;
  approved_at: string | null;
  updated_at: string;
};

const norm = (value: unknown) => String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim();

const same = (a: string, b: string) => {
  const x = norm(a);
  const y = norm(b);
  return Boolean(x) && Boolean(y) && (x === y || x.includes(y) || y.includes(x));
};

/** Validator paket photo-to-video: mengunci Selected Concept dan aturan motion/durasi. */
export function validatePhotoToVideoPackage(
  pkg: PhotoToVideoPackage,
  concept: {
    hook: string;
    main_problem: string;
    main_solution: string;
    payoff: string;
    CTA: string;
    slide_count: number;
  },
): PhotoToVideoValidation {
  const issues: PhotoToVideoIssue[] = [];
  const add = (failed_rule: string, reason: string, affected_scene: number | null = null) =>
    issues.push({ failed_rule, affected_scene, reason });

  if (!same(pkg.selected_hook, concept.hook))
    add("HOOK_CHANGED", "Hook final berubah dari Selected Concept.");
  if (concept.main_problem && !same(pkg.main_problem, concept.main_problem))
    add("PROBLEM_CHANGED", "Problem utama berbeda dengan Prompt Carousel.");
  if (concept.main_solution && !same(pkg.main_solution, concept.main_solution))
    add("SOLUTION_CHANGED", "Solusi utama berbeda dengan Prompt Carousel.");
  if (concept.payoff && !same(pkg.payoff, concept.payoff))
    add("PAYOFF_CHANGED", "Payoff berbeda dengan Prompt Carousel.");
  if (concept.CTA && !same(pkg.CTA, concept.CTA))
    add("CTA_CHANGED", "CTA berbeda dengan Prompt Carousel.");

  if (!norm(pkg.character_lock)) add("CHARACTER_LOCK_MISSING", "Character lock kosong.");
  if (!norm(pkg.product_lock)) add("PRODUCT_LOCK_MISSING", "Product lock kosong.");
  if (!norm(pkg.environment_lock)) add("ENVIRONMENT_LOCK_MISSING", "Environment lock kosong.");
  if (pkg.aspect_ratio !== "9:16") add("RATIO_INVALID", "Aspect ratio wajib 9:16.");
  if (pkg.resolution !== "1080x1920") add("RESOLUTION_INVALID", "Resolusi wajib 1080x1920.");

  const scenes = pkg.scenes ?? [];
  if (scenes.length !== concept.slide_count)
    add(
      "SCENE_COUNT_MISMATCH",
      `Jumlah scene ${scenes.length} tidak sama dengan jumlah visual carousel ${concept.slide_count}.`,
    );

  scenes.forEach((scene) => {
    const n = scene.scene_number;
    if (!VIDEO_DURATIONS.includes(scene.duration_seconds))
      add("DURATION_INVALID", "Durasi wajib 4, 6, 8, atau 10 detik.", n);
    if (!norm(scene.original_carousel_visual))
      add("CAROUSEL_VISUAL_MISSING", "Scene tidak merujuk visual carousel asal.", n);
    if (!norm(scene.primary_subject_motion))
      add("PRIMARY_MOTION_MISSING", "Primary subject motion kosong.", n);
    if (!norm(scene.camera_motion)) add("CAMERA_MOTION_MISSING", "Camera movement kosong.", n);
    if (!norm(scene.environment_motion))
      add("ENVIRONMENT_MOTION_MISSING", "Environment movement kosong.", n);
    if (!norm(scene.ending_frame)) add("ENDING_FRAME_MISSING", "Ending frame kosong.", n);
    const prompt = norm(scene.photo_to_video_prompt);
    if (!prompt) add("VIDEO_PROMPT_MISSING", "Photo-to-video prompt kosong.", n);
    else if (!prompt.includes("9:16")) add("VERTICAL_MISSING", "Prompt belum menyebut video vertikal 9:16.", n);
    if (!norm(scene.video_negative_prompt).includes("no text"))
      add("NEGATIVE_PROMPT_INVALID", "Video negative prompt belum melarang teks.", n);
  });

  return { passed: issues.length === 0, issues, checked_at: new Date().toISOString() };
}

/** Prompt siap tempel untuk satu scene. */
export function formatScenePrompt(scene: PhotoToVideoScene) {
  return [
    "KERJAKU PHOTO TO VIDEO",
    "",
    "Scene:",
    String(scene.scene_number),
    "",
    "Source:",
    `Carousel Slide ${scene.source_carousel_slide}`,
    "",
    "Duration:",
    `${scene.duration_seconds} seconds`,
    "",
    "Video Prompt:",
    "",
    scene.photo_to_video_prompt,
    "",
    "Negative Prompt:",
    "",
    scene.video_negative_prompt,
  ].join("\n");
}

export function formatVideoPackage(pkg: PhotoToVideoPackage, scenes: PhotoToVideoScene[]) {
  return [
    `KERJAKU PHOTO TO VIDEO PACKAGE — ${pkg.video_title}`,
    `Hook final: ${pkg.selected_hook}`,
    `Problem: ${pkg.main_problem}`,
    `Solution: ${pkg.main_solution}`,
    `Payoff: ${pkg.payoff}`,
    `CTA: ${pkg.CTA}`,
    `Character lock: ${pkg.character_lock}`,
    `Product lock: ${pkg.product_lock}`,
    `Environment lock: ${pkg.environment_lock}`,
    `Format: ${pkg.aspect_ratio} · ${pkg.resolution}`,
    "",
    ...scenes.map(formatScenePrompt),
  ].join("\n\n");
}

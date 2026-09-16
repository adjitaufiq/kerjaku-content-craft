/** Tipe bersama Output Prompt · Text-to-Photo Carousel (aman untuk client & server). */

export type CarouselPromptStatus =
  | "NOT_GENERATED"
  | "GENERATING"
  | "DRAFT"
  | "NEEDS_REVISION"
  | "READY_FOR_REVIEW"
  | "APPROVED_PROMPT"
  | "GENERATION_FAILED";

export type CarouselSlideCount = 5 | 7 | 10;

export type CarouselTextLevel = "singkat" | "sedang" | "detail";

export const VISUAL_STYLE_OPTIONS = [
  { value: "brand_center", label: "Mengikuti Brand Center" },
  { value: "realistic_editorial", label: "Realistic Editorial" },
  { value: "cinematic", label: "Cinematic" },
  { value: "minimalist", label: "Minimalist" },
  { value: "professional_corporate", label: "Professional Corporate" },
  { value: "modern_illustration", label: "Modern Illustration" },
  { value: "custom", label: "Custom" },
] as const;

export type CarouselPromptSlide = {
  slide_number: number;
  narrative_function: string;
  headline: string;
  supporting_text: string;
  key_message: string;
  visual_concept: string;
  subject: string;
  subject_action: string;
  facial_expression: string;
  environment: string;
  camera_shot: string;
  composition: string;
  lighting: string;
  color_direction: string;
  text_safe_area: string;
  image_prompt: string;
  negative_prompt: string;
  layout_direction: string;
  continuity_instruction: string;
  engagement_role: string;
  validation_status: string;
};

export type CarouselPromptPackage = {
  carousel_title: string;
  source_id: string;
  selected_concept_id: string;
  analysis_version: string;
  ATM_version: string;
  slide_count: number;

  selected_hook: string;
  pattern_interrupt: string;
  psychological_trigger: string;
  curiosity_gap: string;
  power_word: string;

  main_problem: string;
  main_solution: string;
  payoff: string;
  CTA: string;
  primary_engagement_objective: string;

  visual_style: string;
  aspect_ratio: "4:5";
  resolution: "1080x1350";

  character_lock: string;
  slides: CarouselPromptSlide[];
};

export type CarouselValidationIssue = {
  failed_rule: string;
  affected_slide: number | null;
  reason: string;
};

export type CarouselValidation = {
  passed: boolean;
  issues: CarouselValidationIssue[];
  checked_at: string;
};

export type CarouselPromptRecord = {
  id: string;
  version_id: string;
  source_id: string;
  status: CarouselPromptStatus;
  slide_count: number;
  visual_style: string;
  text_level: CarouselTextLevel;
  package: CarouselPromptPackage;
  slides: CarouselPromptSlide[];
  validation: CarouselValidation;
  model: string;
  approved_at: string | null;
  updated_at: string;
};

export const NEGATIVE_PROMPT_SUFFIX =
  "No text, no letters, no captions, no logo, no watermark.";

const norm = (value: unknown) => String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Validator paket prompt carousel. Dipakai server sebelum menyimpan dan
 * client untuk menampilkan alasan NEEDS_REVISION.
 */
export function validateCarouselPackage(
  pkg: CarouselPromptPackage,
  concept: {
    hook: string;
    pattern_interrupt: string;
    psychological_trigger: string;
    curiosity_gap: string;
    power_words: string[];
  } | null,
): CarouselValidation {
  const issues: CarouselValidationIssue[] = [];
  const add = (failed_rule: string, reason: string, affected_slide: number | null = null) =>
    issues.push({ failed_rule, affected_slide, reason });

  if (!concept) {
    add("SELECTED_CONCEPT_REQUIRED", "Selected Concept tidak tersedia.");
    return { passed: false, issues, checked_at: new Date().toISOString() };
  }

  const same = (a: string, b: string) => {
    const x = norm(a);
    const y = norm(b);
    return Boolean(x) && Boolean(y) && (x === y || x.includes(y) || y.includes(x));
  };

  if (!same(pkg.selected_hook, concept.hook))
    add("HOOK_MISMATCH", "Hook pada paket berbeda dengan Selected Concept.");
  if (!same(pkg.pattern_interrupt, concept.pattern_interrupt || pkg.pattern_interrupt))
    add("PATTERN_INTERRUPT_MISMATCH", "Pattern interrupt berbeda dengan Selected Concept.");
  if (!same(pkg.psychological_trigger, concept.psychological_trigger))
    add("PSYCHOLOGICAL_TRIGGER_MISMATCH", "Psychological trigger berbeda dengan Selected Concept.");
  if (!norm(pkg.curiosity_gap)) add("CURIOSITY_GAP_MISSING", "Curiosity gap kosong.");
  if (!norm(pkg.power_word)) add("POWER_WORD_MISSING", "Power word kosong.");
  if (!norm(pkg.main_problem)) add("PROBLEM_MISSING", "Problem utama kosong.");
  if (!norm(pkg.main_solution)) add("SOLUTION_MISSING", "Solution utama kosong.");
  if (!norm(pkg.payoff)) add("PAYOFF_MISSING", "Payoff kosong.");
  if (!norm(pkg.CTA)) add("CTA_MISSING", "CTA kosong.");
  if (!norm(pkg.primary_engagement_objective))
    add("ENGAGEMENT_OBJECTIVE_MISSING", "Primary engagement objective kosong.");
  if (pkg.aspect_ratio !== "4:5") add("RATIO_INVALID", "Aspect ratio wajib 4:5.");
  if (pkg.resolution !== "1080x1350") add("RESOLUTION_INVALID", "Resolusi wajib 1080x1350.");

  const slides = pkg.slides ?? [];
  if (slides.length !== pkg.slide_count)
    add("SLIDE_COUNT_MISMATCH", `Jumlah slide ${slides.length} tidak sesuai pengaturan ${pkg.slide_count}.`);

  const first = slides[0];
  if (!first) add("SLIDE_1_MISSING", "Slide 1 tidak ada.", 1);
  else if (!same(`${first.headline} ${first.key_message}`, concept.hook))
    add("SLIDE_1_HOOK_MISMATCH", "Slide 1 tidak memakai hook final.", 1);

  slides.forEach((slide) => {
    if (!norm(slide.image_prompt)) add("IMAGE_PROMPT_MISSING", "Image prompt kosong.", slide.slide_number);
    if (!norm(slide.text_safe_area)) add("TEXT_SAFE_AREA_MISSING", "Text safe area kosong.", slide.slide_number);
    if (!norm(slide.headline)) add("HEADLINE_MISSING", "Headline kosong.", slide.slide_number);
  });

  const roles = norm(slides.map((s) => s.narrative_function).join(" "));
  if (slides.length && !roles.includes("cta"))
    add("CTA_SLIDE_MISSING", "Slide CTA tidak ditemukan pada struktur carousel.");

  return { passed: issues.length === 0, issues, checked_at: new Date().toISOString() };
}

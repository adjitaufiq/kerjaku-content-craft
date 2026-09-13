import type {
  CaptionOption,
  CarouselSlide,
  ContentInfo,
  CtaOption,
  HashtagSet,
} from "@/lib/content-production.server";

export const ALLOWED_CTA_TYPES = ["comment", "save", "share", "discussion"] as const;
export const MIN_CATEGORY_SCORE = 70;
export const MIN_AVERAGE_SCORE = 75;
export const MIN_SOURCE_FIDELITY_CONSERVATIVE = 80;

const ACTION_WORDS = [
  "komentar", "komen", "tulis", "ketik", "simpan", "save", "bagikan", "share", "kirim",
  "tag", "coba", "mulai", "ikuti", "follow", "cek", "lihat", "diskusi", "ceritakan",
  "jawab", "balas", "pilih", "download", "unduh", "klik", "gunakan", "terapkan",
];

export type StructuralIssue = { field: string; location: string; detail: string };
export type StructuralResult = { passed: boolean; issues: StructuralIssue[] };

export type RuleIssue = {
  rule: "power_word" | "cta" | "product" | "hashtag";
  severity: "hard" | "soft";
  detail: string;
};
export type RuleResult = { passed: boolean; issues: RuleIssue[] };

export type ProductionAssets = {
  content_info: ContentInfo;
  carousel_structure: CarouselSlide[];
  caption_options: CaptionOption[];
  cta_options: CtaOption[];
  hashtags: HashtagSet;
};

const norm = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
const isEmpty = (value: unknown) => typeof value !== "string" || value.trim().length === 0;

/** LAYER 1 — validasi struktur dengan kode, tanpa AI. */
export function validateStructure(assets: ProductionAssets): StructuralResult {
  const issues: StructuralIssue[] = [];
  const slides = assets.carousel_structure ?? [];

  if (slides.length === 0) {
    issues.push({ field: "carousel_structure", location: "carousel", detail: "Tidak ada slide carousel." });
  }

  const opener = slides[0];
  if (opener) {
    const required: Array<keyof CarouselSlide> = [
      "hook",
      "pattern_interrupt",
      "psychological_trigger",
      "curiosity_gap",
    ];
    for (const field of required) {
      if (isEmpty(opener[field])) {
        issues.push({ field: String(field), location: "slide 1", detail: `${String(field)} kosong pada slide pembuka.` });
      }
    }
    if (!Array.isArray(opener.power_words) || opener.power_words.filter((w) => w.trim()).length === 0) {
      issues.push({ field: "power_words", location: "slide 1", detail: "power_words kosong pada slide pembuka." });
    }
  }

  slides.forEach((slide) => {
    if (isEmpty(slide.headline)) {
      issues.push({ field: "headline", location: `slide ${slide.slide_number}`, detail: "headline kosong." });
    }
  });

  const lastSlide = slides[slides.length - 1];
  if (lastSlide && isEmpty(lastSlide.cta)) {
    issues.push({ field: "cta", location: `slide ${lastSlide.slide_number}`, detail: "cta kosong pada slide penutup." });
  }

  const ctas = assets.cta_options ?? [];
  if (ctas.length === 0) {
    issues.push({ field: "cta_options", location: "cta", detail: "Tidak ada opsi CTA." });
  }
  ctas.forEach((cta, index) => {
    if (isEmpty(cta.cta_text)) {
      issues.push({ field: "cta", location: `cta #${index + 1}`, detail: "cta_text kosong." });
    }
    if (isEmpty(cta.cta_type)) {
      issues.push({ field: "cta_type", location: `cta #${index + 1}`, detail: "cta_type kosong." });
    }
  });

  if ((assets.caption_options ?? []).length === 0) {
    issues.push({ field: "caption_options", location: "caption", detail: "Tidak ada opsi caption." });
  }

  return { passed: issues.length === 0, issues };
}

export type RuleContext = {
  assets: ProductionAssets;
  /** Nama produk/tool yang sah: dari Source Content Report atau Brand Knowledge. */
  allowedProductNames: string[];
  /** Korpus teks sumber + brand knowledge untuk validasi produk. */
  referenceCorpus: string;
  brandName: string;
  topicKeywords: string[];
  audienceKeywords: string[];
};

const STOPWORDS = new Set([
  "instagram", "reels", "kerjaku", "ai", "cta", "indonesia", "senin", "selasa", "rabu",
  "kamis", "jumat", "sabtu", "minggu", "januari", "februari", "maret", "april", "mei",
  "juni", "juli", "agustus", "september", "oktober", "november", "desember",
]);

function candidateProductNames(text: string): string[] {
  const matches = text.match(/\b[A-Z][a-zA-Z0-9]+(?:\s[A-Z][a-zA-Z0-9]+)?\b/g) ?? [];
  const unique = new Set<string>();
  for (const match of matches) {
    const value = match.trim();
    if (value.length < 4) continue;
    if (STOPWORDS.has(norm(value))) continue;
    unique.add(value);
  }
  return [...unique];
}

/** LAYER 2 — validasi aturan deterministik. */
export function validateRules(context: RuleContext): RuleResult {
  const issues: RuleIssue[] = [];
  const { assets } = context;
  const slides = assets.carousel_structure ?? [];
  const captions = assets.caption_options ?? [];

  const searchable = norm(
    [
      ...slides.map((slide) => `${slide.hook} ${slide.headline} ${slide.body_text}`),
      ...captions.map((caption) => `${caption.hook} ${caption.body} ${caption.cta}`),
    ].join(" "),
  );

  // 1. Power word validation
  const powerWords = [...new Set(slides.flatMap((slide) => slide.power_words ?? []).map((w) => w.trim()).filter(Boolean))];
  if (powerWords.length === 0) {
    issues.push({ rule: "power_word", severity: "hard", detail: "Tidak ada power word pada seluruh slide." });
  }
  const unusedPowerWords = powerWords.filter((word) => !searchable.includes(norm(word)));
  if (unusedPowerWords.length > 0) {
    issues.push({
      rule: "power_word",
      severity: unusedPowerWords.length === powerWords.length ? "hard" : "soft",
      detail: `Power word tidak muncul di hook, headline, atau caption: ${unusedPowerWords.join(", ")}.`,
    });
  }

  // 2. CTA validation
  for (const cta of assets.cta_options ?? []) {
    if (!ALLOWED_CTA_TYPES.includes(cta.cta_type)) {
      issues.push({ rule: "cta", severity: "hard", detail: `cta_type "${cta.cta_type}" tidak diizinkan.` });
    }
    const text = norm(cta.cta_text ?? "");
    if (!ACTION_WORDS.some((word) => text.includes(word))) {
      issues.push({ rule: "cta", severity: "hard", detail: `CTA "${cta.cta_text}" tidak memiliki kata ajakan.` });
    }
  }

  // 3. Product validation
  const corpus = norm(`${context.referenceCorpus} ${context.allowedProductNames.join(" ")} ${context.brandName}`);
  const contentText = [
    assets.content_info?.title ?? "",
    ...slides.map((slide) => `${slide.headline} ${slide.body_text} ${slide.cta}`),
    ...captions.map((caption) => `${caption.hook} ${caption.body} ${caption.cta}`),
  ].join(" ");
  const invented = candidateProductNames(contentText).filter((name) => !corpus.includes(norm(name)));
  if (invented.length > 0) {
    issues.push({
      rule: "product",
      severity: "soft",
      detail: `Nama/entitas berikut tidak ditemukan di Source Content Report maupun Brand Knowledge: ${invented.join(", ")}.`,
    });
  }

  // 4. Hashtag validation
  const hashtags = assets.hashtags ?? { broad: [], niche: [], brand: [] };
  const all = [...(hashtags.broad ?? []), ...(hashtags.niche ?? []), ...(hashtags.brand ?? [])];
  if (all.length === 0) {
    issues.push({ rule: "hashtag", severity: "hard", detail: "Tidak ada hashtag." });
  }
  const malformed = all.filter((tag) => !/^#[\p{L}\p{N}_]+$/u.test(tag.trim()));
  if (malformed.length > 0) {
    issues.push({ rule: "hashtag", severity: "hard", detail: `Format hashtag tidak valid: ${malformed.join(", ")}.` });
  }
  const brandSlug = norm(context.brandName).replace(/[^a-z0-9]/g, "");
  if (brandSlug && !(hashtags.brand ?? []).some((tag) => norm(tag).replace(/[^a-z0-9]/g, "").includes(brandSlug))) {
    issues.push({ rule: "hashtag", severity: "soft", detail: "Tidak ada hashtag brand yang memuat nama brand." });
  }
  const nicheText = norm((hashtags.niche ?? []).join(" "));
  const topicHit = [...context.topicKeywords, ...context.audienceKeywords]
    .map((word) => norm(word).replace(/[^a-z0-9]/g, ""))
    .filter((word) => word.length > 3)
    .some((word) => nicheText.replace(/[^a-z0-9 ]/g, "").includes(word));
  if ((hashtags.niche ?? []).length > 0 && !topicHit) {
    issues.push({ rule: "hashtag", severity: "soft", detail: "Hashtag niche tidak terhubung dengan topik atau audience konten." });
  }

  return { passed: !issues.some((issue) => issue.severity === "hard"), issues };
}

export type JudgeCategory =
  | "pattern_interrupt"
  | "psychological_trigger"
  | "curiosity_gap"
  | "power_word"
  | "cta"
  | "source_fidelity"
  | "brand_safety";

export type JudgeScore = { score: number; reason: string; improvement_suggestion: string };
export type JudgeReport = Record<JudgeCategory, JudgeScore> & { summary: string };

export type QualityDecision = {
  status: "ready_production" | "revision_needed";
  overall: number;
  hardFailures: string[];
  failedCriteria: Array<{ criteria: string; detail: string; improvement: string }>;
};

export function decideQuality(input: {
  mode: "conservative" | "creative";
  structural: StructuralResult;
  rules: RuleResult;
  judge: JudgeReport;
}): QualityDecision {
  const hardFailures: string[] = [];
  const failedCriteria: QualityDecision["failedCriteria"] = [];

  if (!input.structural.passed) {
    hardFailures.push("structural_validation");
    input.structural.issues.forEach((issue) =>
      failedCriteria.push({
        criteria: `Struktur · ${issue.field}`,
        detail: `${issue.location}: ${issue.detail}`,
        improvement: "Lengkapi field wajib pada hasil produksi lalu jalankan ulang produksi konten.",
      }),
    );
  }
  input.rules.issues.forEach((issue) => {
    if (issue.severity === "hard") hardFailures.push(`rule_${issue.rule}`);
    failedCriteria.push({
      criteria: `Aturan · ${issue.rule}`,
      detail: issue.detail,
      improvement:
        issue.rule === "product"
          ? "Gunakan hanya nama produk/tool dari Source Content Report atau Brand Knowledge."
          : "Perbaiki elemen ini pada hasil produksi konten.",
    });
  });

  const categories: JudgeCategory[] = [
    "pattern_interrupt",
    "psychological_trigger",
    "curiosity_gap",
    "power_word",
    "cta",
    "source_fidelity",
    "brand_safety",
  ];
  const scores = categories.map((key) => input.judge[key]?.score ?? 0);
  const overall = Math.round(scores.reduce((sum, value) => sum + value, 0) / categories.length);

  const minFidelity = input.mode === "conservative" ? MIN_SOURCE_FIDELITY_CONSERVATIVE : MIN_CATEGORY_SCORE;
  categories.forEach((key) => {
    const entry = input.judge[key];
    const minimum = key === "source_fidelity" ? minFidelity : MIN_CATEGORY_SCORE;
    if (!entry || entry.score < minimum) {
      if (key === "brand_safety" || key === "source_fidelity") hardFailures.push(key);
      failedCriteria.push({
        criteria: `Skor · ${key}`,
        detail: `${entry?.score ?? 0}/100 di bawah minimum ${minimum}. ${entry?.reason ?? ""}`.trim(),
        improvement: entry?.improvement_suggestion ?? "Perbaiki aspek ini lalu jalankan ulang produksi konten.",
      });
    }
  });

  if (overall < MIN_AVERAGE_SCORE) {
    failedCriteria.push({
      criteria: "Skor rata-rata",
      detail: `Rata-rata ${overall} di bawah minimum ${MIN_AVERAGE_SCORE}.`,
      improvement: "Perkuat kategori dengan skor terendah.",
    });
  }

  const passed = hardFailures.length === 0 && failedCriteria.length === 0;
  return {
    status: passed ? "ready_production" : "revision_needed",
    overall,
    hardFailures: [...new Set(hardFailures)],
    failedCriteria,
  };
}

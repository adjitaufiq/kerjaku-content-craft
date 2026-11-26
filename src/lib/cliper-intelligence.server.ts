import { routeStructured, routeTaskStructured } from "./ai-router.server";
export type DnaEvidence = {
  source_type: "transcript" | "on_screen_text" | "visual";
  timestamp: string;
  quote: string;
};

export type StoryBeat = {
  order: number;
  role: string;
  description: string;
  evidence: DnaEvidence[];
};

export type ViralDnaResult = {
  hook: string;
  hook_type: string;
  hook_reason: string;
  pattern_interrupt: string;
  psychological_trigger: string;
  curiosity_gap: string;
  power_words: string[];
  structure_type: string;
  story_beats: StoryBeat[];
  retention_factor: string;
  engagement_factor: string;
  save_trigger: string;
  share_trigger: string;
  comment_trigger: string;
  hook_category: string;
  structure_category: string;
  trigger_category: string;
  evidence: DnaEvidence[];
};

export type BrandKnowledgeInput = {
  profile: {
    brand_name: string;
    positioning: string;
    audience: string;
    tone_of_voice: string;
    mission: string;
    version: string;
  };
  products: Array<{ name: string; description: string; benefit: string }>;
  rules: Array<{ rule: string; rule_type: string }>;
  power_words: Array<{ word: string; context: string }>;
};

export type AtmResult = {
  source_mapping: {
    preserved_formula: string[];
    changed_elements: string[];
    evidence_links: DnaEvidence[];
  };
  adaptation: {
    strategic_premise: string;
    target_audience_relevance: string;
    storytelling_direction: string;
    brand_voice_direction: string;
    product_connection: string;
    originality_safeguards: string[];
    source_formula: string[];
    target_audience: string;
    angle_ideas: string[];
    example_hooks: string[];
    recommended_format: string;
  };
  reason: string;
};

export type HookCandidate = {
  id: string;
  hook: string;
  hook_type: string;
  rationale: string;
  psychological_trigger: string;
  curiosity_gap: string;
  power_words: string[];
  risk_note: string;
};

export type HookMatrixResult = { candidates: HookCandidate[] };

const EVIDENCE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["source_type", "timestamp", "quote"],
  properties: {
    source_type: { type: "string", enum: ["transcript", "on_screen_text", "visual"] },
    timestamp: { type: "string" },
    quote: { type: "string" },
  },
} as const;

const DNA_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "hook",
    "hook_type",
    "hook_reason",
    "pattern_interrupt",
    "psychological_trigger",
    "curiosity_gap",
    "power_words",
    "structure_type",
    "story_beats",
    "retention_factor",
    "engagement_factor",
    "save_trigger",
    "share_trigger",
    "comment_trigger",
    "hook_category",
    "structure_category",
    "trigger_category",
    "evidence",
  ],
  properties: {
    hook: { type: "string" },
    hook_type: { type: "string" },
    hook_reason: { type: "string" },
    pattern_interrupt: { type: "string" },
    psychological_trigger: { type: "string" },
    curiosity_gap: { type: "string" },
    power_words: { type: "array", items: { type: "string" } },
    structure_type: { type: "string" },
    story_beats: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["order", "role", "description", "evidence"],
        properties: {
          order: { type: "integer" },
          role: { type: "string" },
          description: { type: "string" },
          evidence: { type: "array", items: EVIDENCE_SCHEMA },
        },
      },
    },
    retention_factor: { type: "string" },
    engagement_factor: { type: "string" },
    save_trigger: { type: "string" },
    share_trigger: { type: "string" },
    comment_trigger: { type: "string" },
    hook_category: {
      type: "string",
      enum: [
        "question",
        "bold_claim",
        "problem_callout",
        "story_open",
        "contrarian",
        "demonstration",
        "list_promise",
        "other",
      ],
    },
    structure_category: {
      type: "string",
      enum: [
        "problem_solution",
        "story_arc",
        "listicle",
        "tutorial",
        "comparison",
        "myth_busting",
        "case_study",
        "other",
      ],
    },
    trigger_category: {
      type: "string",
      enum: [
        "curiosity",
        "fear_of_missing_out",
        "social_proof",
        "identity",
        "urgency",
        "surprise",
        "empathy",
        "other",
      ],
    },
    evidence: { type: "array", items: EVIDENCE_SCHEMA },
  },
} as const;

const ATM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["source_mapping", "adaptation", "reason"],
  properties: {
    source_mapping: {
      type: "object",
      additionalProperties: false,
      required: ["preserved_formula", "changed_elements", "evidence_links"],
      properties: {
        preserved_formula: { type: "array", items: { type: "string" } },
        changed_elements: { type: "array", items: { type: "string" } },
        evidence_links: { type: "array", items: EVIDENCE_SCHEMA },
      },
    },
    adaptation: {
      type: "object",
      additionalProperties: false,
      required: [
        "strategic_premise",
        "target_audience_relevance",
        "storytelling_direction",
        "brand_voice_direction",
        "product_connection",
        "originality_safeguards",
        "source_formula",
        "target_audience",
        "angle_ideas",
        "example_hooks",
        "recommended_format",
      ],
      properties: {
        strategic_premise: { type: "string" },
        target_audience_relevance: { type: "string" },
        storytelling_direction: { type: "string" },
        brand_voice_direction: { type: "string" },
        product_connection: { type: "string" },
        originality_safeguards: { type: "array", items: { type: "string" } },
        source_formula: { type: "array", items: { type: "string" } },
        target_audience: { type: "string" },
        angle_ideas: { type: "array", items: { type: "string" } },
        example_hooks: { type: "array", items: { type: "string" } },
        recommended_format: { type: "string" },
      },
    },
    reason: { type: "string" },
  },
} as const;

const HOOK_MATRIX_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["candidates"],
  properties: {
    candidates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "hook",
          "hook_type",
          "rationale",
          "psychological_trigger",
          "curiosity_gap",
          "power_words",
          "risk_note",
        ],
        properties: {
          id: { type: "string" },
          hook: { type: "string" },
          hook_type: { type: "string" },
          rationale: { type: "string" },
          psychological_trigger: { type: "string" },
          curiosity_gap: { type: "string" },
          power_words: { type: "array", items: { type: "string" } },
          risk_note: { type: "string" },
        },
      },
    },
  },
} as const;

async function streamStructured<T>(
  input: {
    instructions: string;
    prompt: string;
    name: string;
    schema: Record<string, unknown>;
  },
  execution?: { taskId: string; worker: string },
): Promise<{ result: T; model: string }> {
  const request = {
    ...input,
    capability: input.name.includes("atm")
      ? ("CONTENT_REMIX" as const)
      : input.name.includes("hook")
        ? ("CONTENT_STRATEGY" as const)
        : ("VIRAL_ANALYSIS" as const),
  };
  return execution
    ? routeTaskStructured<T>(request, execution.taskId, execution.worker)
    : routeStructured<T>(request);
}

export type DnaSourceMaterial = {
  source_report: unknown;
  transcript: Array<{ timestamp: string; text: string }>;
  on_screen_text: Array<{ timestamp: string; text: string }>;
  snapshots: Array<{ timestamp: string; reason: string }>;
  visual_analysis: Array<{ timestamp: string; scene: string; description: string }>;
};

export async function analyzeViralDna(
  material: DnaSourceMaterial,
  execution?: { taskId: string; worker: string },
): Promise<{ result: ViralDnaResult; model: string }> {
  const { result, model } = await streamStructured<ViralDnaResult>(
    {
      name: "viral_dna_analysis",
      schema: DNA_SCHEMA,
      instructions: [
        "Kamu adalah analis pembedah video. Tugasmu HANYA membedah video sumber yang datanya diberikan.",
        "DILARANG KERAS membuat hook baru, script, caption, konsep konten, arah ATM, atau saran strategi marketing. Jangan memberi rekomendasi produksi.",
        "Setiap field teks wajib memakai dua lapis dalam satu paragraf: (1) OBSERVASI fakta yang benar-benar terdengar/terlihat beserta timestamp, lalu (2) ANALISIS singkat mengapa elemen itu bekerja.",
        'Format wajib: "Pada 00:00 terdengar/terlihat \\"kutipan atau kejadian nyata\\". Ini bekerja karena ...".',
        'Dilarang menulis kalimat teori umum tanpa timestamp, misalnya "creator memakai teknik curiosity" atau "visual menarik".',
        "pattern_interrupt dan bagian visual wajib merujuk perpindahan visual yang tercatat pada snapshot/visual analysis, bukan tebakan.",
        "story_beats harus memakai urutan asli video (pembuka, masalah, penjelasan, contoh, penutup/CTA) sesuai yang teramati, satu beat per bagian nyata.",
        "engagement_factor dipecah lebih jelas ke save_trigger, share_trigger, comment_trigger. Jika CTA terlihat eksplisit, kutip kalimat CTA-nya dahulu lalu jelaskan mekanismenya.",
        "power_words hanya kata yang benar-benar diucapkan atau muncul di layar.",
        "Evidence wajib disalin persis dari transcript, on_screen_text, snapshot, atau visual analysis: source_type, timestamp, dan quote apa adanya. Jangan mengarang timestamp atau kutipan.",
        "Jika sebuah elemen tidak teramati di sumber, tulis apa adanya bahwa elemen itu tidak teramati. Jangan mengisinya dengan asumsi.",
        "Pilih hook_category, structure_category, dan trigger_category dari enum yang tersedia. Jawab ringkas dalam Bahasa Indonesia yang mudah dipahami creator.",
      ].join(" "),
      prompt: [
        "Bedah video berikut berdasarkan bukti asli. Abaikan evidence dengan verified=false pada laporan.",
        `Transcript bertimestamp: ${JSON.stringify(material.transcript)}`,
        `Teks pada layar (OCR): ${JSON.stringify(material.on_screen_text)}`,
        `Snapshot frame: ${JSON.stringify(material.snapshots)}`,
        `Analisis visual per scene: ${JSON.stringify(material.visual_analysis)}`,
        `Source Content Report: ${JSON.stringify(material.source_report)}`,
      ].join("\n\n"),
    },
    execution,
  );
  return { result, model };
}

export async function generateAtmVersion(
  input: {
    mode: "conservative" | "creative";
    angle: string;
    dna: ViralDnaResult;
    brand: BrandKnowledgeInput;
    readiness_level?: "EMPTY" | "PARTIAL" | "COMPLETE";
    assumed_fields?: string[];
    source_context?: {
      source_report?: unknown;
      transcript?: unknown;
      on_screen_text?: unknown;
    };
  },
  execution?: { taskId: string; worker: string },
): Promise<{ result: AtmResult; model: string }> {
  const modeRule =
    input.mode === "conservative"
      ? "Pertahankan formula, urutan persuasi, dan mekanisme retensi utama. Ubah konteks, contoh, angle, dan bahasa agar asli serta sesuai brand."
      : "Ambil prinsip psikologis dan mekanisme viralnya, lalu ubah angle dan storytelling direction secara lebih jauh. Jangan mempertahankan urutan atau ekspresi sumber bila tidak perlu.";
  const fallbackRule = [
    "Brand Knowledge boleh kosong atau hanya terisi sebagian — itu BUKAN error dan bukan alasan menolak tugas.",
    "Urutan prioritas konteks: (1) field Brand Knowledge yang benar-benar diisi user, (2) Source Content Report, (3) transcript dan teks layar, (4) Viral DNA, (5) asumsi AI sebagai jalan terakhir.",
    "DILARANG menimpa atau mengubah nilai brand yang sudah diisi user.",
    'Untuk bagian brand yang kosong, susun asumsi kerja yang hati-hati dan tandai secara eksplisit dengan awalan "Asumsi:".',
    "DILARANG mengarang nama produk, harga, promo, testimoni, angka performa, benefit spesifik, atau data bisnis yang tidak ada pada Brand Knowledge maupun sumber.",
    "Jika tidak ada produk terdaftar, isi product_connection sebagai arahan umum tanpa menyebut nama produk apa pun.",
  ].join(" ");
  const { result, model } = await streamStructured<AtmResult>(
    {
      name: "kerjaku_atm_version",
      schema: ATM_SCHEMA,
      instructions: `Kamu adalah KERJAKU ATM Engine. ATM berarti Amati formula, Tiru prinsip, Modifikasi eksekusi. Kamu bekerja OTOMATIS: sumber utama keputusanmu adalah Viral DNA (hook, pattern interrupt, psychological trigger, curiosity gap, retention, struktur, CTA, evidence) plus Brand Knowledge KERJAKU yang tersedia. Jika ada tambahan arahan pengguna, perlakukan sebagai constraint tambahan saja, bukan sumber utama; jika kosong, tentukan sendiri arah terbaik dari Viral DNA. ${fallbackRule} Wajib mengisi source_formula (formula sumber yang ditemukan), preserved_formula (prinsip dipertahankan), changed_elements (elemen diubah), reason (alasan adaptasi untuk KERJAKU), target_audience, angle_ideas (2-4 ide angle), example_hooks (2-3 contoh hook baru orisinal), dan recommended_format (format konten yang disarankan, misal carousel edukasi atau reels talking head). Kamu hanya menyusun arahan strategis sebelum produksi—DILARANG membuat carousel jadi, caption, storyboard, atau script siap terbit. ${modeRule} Patuhi seluruh aturan brand yang tersedia. Bukti harus disalin dari Viral DNA, jangan mengarang bukti baru. Jawab dalam Bahasa Indonesia.`,
      prompt: [
        `Mode: ${input.mode}`,
        input.angle.trim()
          ? `Tambahan arahan pengguna (constraint tambahan, bukan sumber utama): ${input.angle.trim()}`
          : "Tidak ada tambahan arahan pengguna. Tentukan arah dan angle sepenuhnya dari Viral DNA dan konteks yang tersedia.",
        `Kelengkapan Brand Knowledge: ${input.readiness_level ?? "PARTIAL"}`,
        input.assumed_fields?.length
          ? `Field brand yang kosong dan boleh diisi asumsi hati-hati: ${input.assumed_fields.join(", ")}`
          : "Seluruh field brand inti tersedia. Jangan memakai asumsi.",
        `Viral DNA: ${JSON.stringify(input.dna)}`,
        `Brand Knowledge (hanya field terisi yang valid): ${JSON.stringify(input.brand)}`,
        input.source_context
          ? `Konteks sumber (fallback saat brand kosong): ${JSON.stringify(input.source_context).slice(0, 12000)}`
          : "Konteks sumber tambahan tidak tersedia.",
        "Buat pemetaan formula sumber ke arahan adaptasi orisinal KERJAKU dan jelaskan alasan strateginya.",
      ].join("\n\n"),
    },
    execution,
  );
  return { result, model };
}

export async function generateHookMatrix(
  input: {
    mode: "conservative" | "creative";
    angle: string;
    dna: ViralDnaResult;
    atm: AtmResult;
    brand: BrandKnowledgeInput;
  },
  execution?: { taskId: string; worker: string },
): Promise<{ result: HookMatrixResult; model: string }> {
  const { result, model } = await streamStructured<HookMatrixResult>(
    {
      name: "kerjaku_hook_matrix",
      schema: HOOK_MATRIX_SCHEMA,
      instructions: `Kamu adalah KERJAKU Viral Hook Matrix Engine. Buat TEPAT 5 kandidat hook pembuka yang berbeda tipe (misalnya pertanyaan, klaim berani, problem callout, cerita, kontrarian). Hook harus orisinal milik KERJAKU—dilarang menyalin kalimat sumber. Setiap hook wajib sejalan dengan angle, arahan ATM, dan Brand Knowledge, serta memakai power words brand bila relevan. id memakai format hook-1 sampai hook-5. Jangan membuat caption, carousel, script, atau storyboard. Jawab dalam Bahasa Indonesia.`,
      prompt: [
        `Mode ATM: ${input.mode}`,
        `Angle: ${input.angle}`,
        `Viral DNA: ${JSON.stringify(input.dna)}`,
        `Arahan ATM: ${JSON.stringify(input.atm)}`,
        `Brand Knowledge: ${JSON.stringify(input.brand)}`,
        "Susun 5 kandidat hook dengan alasan, trigger psikologis, curiosity gap, power words, dan catatan risiko brand.",
      ].join("\n\n"),
    },
    execution,
  );
  return { result, model };
}

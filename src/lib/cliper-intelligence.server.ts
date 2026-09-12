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
  };
  reason: string;
};

const MODEL = "openai/gpt-6-astra";

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
    "hook", "hook_type", "hook_reason", "pattern_interrupt", "psychological_trigger",
    "curiosity_gap", "power_words", "structure_type", "story_beats", "retention_factor",
    "engagement_factor", "save_trigger", "share_trigger", "comment_trigger",
    "hook_category", "structure_category", "trigger_category", "evidence",
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
      enum: ["question", "bold_claim", "problem_callout", "story_open", "contrarian", "demonstration", "list_promise", "other"],
    },
    structure_category: {
      type: "string",
      enum: ["problem_solution", "story_arc", "listicle", "tutorial", "comparison", "myth_busting", "case_study", "other"],
    },
    trigger_category: {
      type: "string",
      enum: ["curiosity", "fear_of_missing_out", "social_proof", "identity", "urgency", "surprise", "empathy", "other"],
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
        "strategic_premise", "target_audience_relevance", "storytelling_direction",
        "brand_voice_direction", "product_connection", "originality_safeguards",
      ],
      properties: {
        strategic_premise: { type: "string" },
        target_audience_relevance: { type: "string" },
        storytelling_direction: { type: "string" },
        brand_voice_direction: { type: "string" },
        product_connection: { type: "string" },
        originality_safeguards: { type: "array", items: { type: "string" } },
      },
    },
    reason: { type: "string" },
  },
} as const;

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
      text: {
        format: { type: "json_schema", name: input.name, strict: true, schema: input.schema },
      },
    }),
  });

  if (!response.ok || !response.body) {
    const raw = await response.text().catch(() => "");
    let message = raw;
    try {
      const parsed = JSON.parse(raw) as { message?: string; error?: { message?: string } };
      message = parsed.message ?? parsed.error?.message ?? raw;
    } catch {
      // Keep the gateway response text.
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
        const event = JSON.parse(payload) as {
          type?: string;
          delta?: string;
          response?: { output_text?: string };
        };
        if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
          output += event.delta;
        } else if (event.type === "response.completed" && event.response?.output_text && !output) {
          output = event.response.output_text;
        }
      } catch {
        // Ignore keep-alive or incomplete SSE frames.
      }
    }
  }
  if (!output.trim()) throw new Error("Lovable AI tidak mengembalikan hasil analisis.");
  try {
    return JSON.parse(output) as T;
  } catch {
    throw new Error("Format hasil Lovable AI tidak valid. Jalankan ulang analisis.");
  }
}

export async function analyzeViralDna(sourceReport: unknown): Promise<{ result: ViralDnaResult; model: string }> {
  const result = await streamStructured<ViralDnaResult>({
    name: "viral_dna_analysis",
    schema: DNA_SCHEMA,
    instructions: `Kamu adalah reverse-engineering analyst untuk konten viral. Analisis mengapa struktur sumber bekerja, bukan membuat ide atau menyalin konten. Gunakan HANYA Source Content Report yang diberikan. Setiap klaim harus didukung evidence terverifikasi yang sudah ada; salin source_type, timestamp, dan quote persis dari evidence sumber. Jangan menambah fakta, produk, klaim, atau timestamp baru. Tentukan juga save_trigger (alasan konten layak disimpan), share_trigger (alasan layak dibagikan), dan comment_trigger (pemicu komentar) berdasarkan mekanisme yang teramati di sumber. Pilih hook_category, structure_category, dan trigger_category dari enum yang tersedia agar pola bisa dipakai ulang. Jawab ringkas dalam Bahasa Indonesia.`,
    prompt: `Analisis Viral DNA dari Source Content Report berikut. Abaikan semua evidence dengan verified=false.\n\n${JSON.stringify(sourceReport)}`,
  });
  return { result, model: MODEL };
}

export async function generateAtmVersion(input: {
  mode: "conservative" | "creative";
  angle: string;
  dna: ViralDnaResult;
  brand: BrandKnowledgeInput;
}): Promise<{ result: AtmResult; model: string }> {
  const modeRule = input.mode === "conservative"
    ? "Pertahankan formula, urutan persuasi, dan mekanisme retensi utama. Ubah konteks, contoh, angle, dan bahasa agar asli serta sesuai brand."
    : "Ambil prinsip psikologis dan mekanisme viralnya, lalu ubah angle dan storytelling direction secara lebih jauh. Jangan mempertahankan urutan atau ekspresi sumber bila tidak perlu.";
  const result = await streamStructured<AtmResult>({
    name: "kerjaku_atm_version",
    schema: ATM_SCHEMA,
    instructions: `Kamu adalah KERJAKU ATM Engine. ATM berarti Amati formula, Tiru prinsip, Modifikasi eksekusi. Kamu hanya menyusun arahan strategis sebelum produksi—DILARANG membuat carousel, caption, storyboard, script, atau konten siap terbit. ${modeRule} Patuhi seluruh Brand Knowledge. Bukti harus disalin dari Viral DNA, jangan mengarang bukti baru. Jawab dalam Bahasa Indonesia.`,
    prompt: [
      `Mode: ${input.mode}`,
      `Angle pilihan pengguna: ${input.angle}`,
      `Viral DNA: ${JSON.stringify(input.dna)}`,
      `Brand Knowledge: ${JSON.stringify(input.brand)}`,
      "Buat pemetaan formula sumber ke arahan adaptasi orisinal KERJAKU dan jelaskan alasan strateginya.",
    ].join("\n\n"),
  });
  return { result, model: MODEL };
}

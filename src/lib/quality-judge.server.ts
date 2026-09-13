import type { JudgeReport, ProductionAssets } from "@/lib/quality-gate";

const MODEL = "openai/gpt-6-astra";

const SCORE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["score", "reason", "improvement_suggestion"],
  properties: {
    score: { type: "integer" },
    reason: { type: "string" },
    improvement_suggestion: { type: "string" },
  },
} as const;

const JUDGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "pattern_interrupt",
    "psychological_trigger",
    "curiosity_gap",
    "power_word",
    "cta",
    "source_fidelity",
    "brand_safety",
    "summary",
  ],
  properties: {
    pattern_interrupt: SCORE_SCHEMA,
    psychological_trigger: SCORE_SCHEMA,
    curiosity_gap: SCORE_SCHEMA,
    power_word: SCORE_SCHEMA,
    cta: SCORE_SCHEMA,
    source_fidelity: SCORE_SCHEMA,
    brand_safety: SCORE_SCHEMA,
    summary: { type: "string" },
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
        // ignore keep-alive frames
      }
    }
  }
  if (!output.trim()) throw new Error("AI Quality Judge tidak mengembalikan hasil penilaian.");
  try {
    return JSON.parse(output) as T;
  } catch {
    throw new Error("Format penilaian mutu tidak valid. Jalankan ulang Quality Gate.");
  }
}

/**
 * LAYER 3 — AI Quality Judge.
 * Evaluator berdiri sendiri: TIDAK memakai prompt generator konten sebelumnya,
 * hanya menerima hasil konten final plus sumber acuan untuk menilai kesetiaan fakta.
 */
export async function judgeContentQuality(input: {
  mode: "conservative" | "creative";
  assets: ProductionAssets;
  sourceReport: unknown;
  brandKnowledge: unknown;
}): Promise<{ report: JudgeReport; model: string }> {
  const report = await streamStructured<JudgeReport>({
    name: "kerjaku_quality_judge",
    schema: JUDGE_SCHEMA,
    instructions: [
      "Kamu adalah AI Quality Judge yang independen. Tugasmu HANYA menilai, bukan membuat atau memperbaiki konten.",
      "Kamu tidak boleh mengasumsikan niat penulis. Nilai apa adanya dari konten final yang diberikan.",
      "Beri skor 0-100 untuk tujuh kategori: pattern_interrupt, psychological_trigger, curiosity_gap, power_word, cta, source_fidelity, brand_safety.",
      "source_fidelity menilai apakah SELURUH fakta, angka, nama produk, dan klaim pada konten dapat ditelusuri ke Source Content Report (dan Brand Knowledge bila mode creative). Fakta yang tidak dapat ditelusuri menurunkan skor secara tajam.",
      input.mode === "conservative"
        ? "Mode Conservative: fakta HANYA boleh dari Source Content Report. Fakta dari Brand Knowledge yang dipakai sebagai informasi baru adalah pelanggaran berat."
        : "Mode Creative: fakta boleh dari Source Content Report atau Brand Knowledge, di luar itu pelanggaran berat.",
      "brand_safety menilai risiko klaim berlebihan, janji hasil pasti, sensitif SARA/politik, menyerang pihak lain, atau melanggar aturan brand.",
      "Setiap kategori wajib memiliki reason singkat dan improvement_suggestion yang konkret dan bisa langsung dikerjakan.",
      "Jawab dalam Bahasa Indonesia.",
    ].join(" "),
    prompt: [
      `ATM Mode: ${input.mode}`,
      `Konten final yang dinilai: ${JSON.stringify(input.assets)}`,
      `Source Content Report (acuan fakta): ${JSON.stringify(input.sourceReport)}`,
      `Brand Knowledge (acuan brand): ${JSON.stringify(input.brandKnowledge)}`,
      "Hasilkan Quality Score Report.",
    ].join("\n\n"),
  });

  return { report, model: MODEL };
}

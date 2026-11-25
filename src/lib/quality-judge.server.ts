import { routeStructured } from "./ai-router.server";
import type { JudgeReport, ProductionAssets } from "@/lib/quality-gate";


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
}): Promise<{ result: T; model: string }> {
  return routeStructured<T>({ ...input, capability: "QUALITY_JUDGE" });
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
  const { result: report, model } = await streamStructured<JudgeReport>({
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

  return { report, model };
}

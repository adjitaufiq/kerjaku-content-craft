export type ViralAnalysisResult = {
  content_summary: string;
  main_topic: string;
  content_category: string;
  storytelling_style: string;
  emotional_angle: string;
  hook_formula: string;
  pattern_interrupt: string;
  psychological_trigger: string;
  curiosity_gap: string;
  power_word: string;
  why_this_works: string;
  audience: string;
  problem: string;
  solution: string;
  modification_ideas: string;
};

const FIELDS: Array<keyof ViralAnalysisResult> = [
  "content_summary",
  "main_topic",
  "content_category",
  "storytelling_style",
  "emotional_angle",
  "hook_formula",
  "pattern_interrupt",
  "psychological_trigger",
  "curiosity_gap",
  "power_word",
  "why_this_works",
  "audience",
  "problem",
  "solution",
  "modification_ideas",
];

const SYSTEM_PROMPT = `Kamu adalah analis konten viral untuk brand @kerjaku.space (konten karier & dunia kerja Indonesia).

Tugasmu: MENGANALISIS FORMULA sebuah konten viral, BUKAN menyalinnya.
Larangan keras:
- Jangan menuliskan ulang caption asli, naskah asli, atau deskripsi visual asli secara verbatim.
- Jangan menghasilkan konten siap pakai yang meniru karya orang lain.
Prinsip kerja: ATM — Amati, Tiru konsep, Modifikasi.

Terapkan KERJAKU Viral Rules:
RULE 1 Pattern Interrupt: kenapa konten ini menghentikan scroll?
RULE 2 Psychological Trigger: pilih dari Curiosity, Fear, Relatability, Authority, Aspiration, Debate (boleh lebih dari satu, sebutkan alasannya).
RULE 3 Curiosity Gap + Power Word: jelaskan jurang rasa penasaran, power word yang dipakai, dan alasan orang bertahan menonton.

Jawab dalam Bahasa Indonesia, padat, konkret, dan actionable. Bila informasi sumber terbatas, analisis berdasarkan judul, platform, kategori, dan pola umum konten sejenis, serta sebutkan asumsimu.`;

function buildSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: Object.fromEntries(FIELDS.map((f) => [f, { type: "string" }])),
    required: FIELDS,
  };
}

export async function analyzeViralReference(input: {
  title: string;
  platform: string;
  category: string | null;
  sourceUrl: string | null;
  hasUpload: boolean;
  notes?: string | null;
}): Promise<{ result: ViralAnalysisResult; model: string }> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("LOVABLE_API_KEY belum tersedia di server.");

  const model = "openai/gpt-6-astra";
  const prompt = [
    `Judul referensi: ${input.title}`,
    `Platform: ${input.platform}`,
    `Kategori: ${input.category ?? "tidak ditentukan"}`,
    `Tautan sumber: ${input.sourceUrl ?? "tidak ada"}`,
    `Video diunggah manual: ${input.hasUpload ? "ya" : "tidak"}`,
    input.notes ? `Catatan tambahan: ${input.notes}` : "",
    "",
    "Buat Viral Analysis Report untuk referensi di atas sesuai KERJAKU Viral Rules.",
    "Isi setiap field secara mandiri (tiap field bisa disalin terpisah).",
    "Field modification_ideas berisi 3 ide modifikasi konsep untuk brand @kerjaku.space, bukan tiruan konten asli.",
  ]
    .filter(Boolean)
    .join("\n");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model,
      instructions: SYSTEM_PROMPT,
      input: prompt,
      stream: true,
      reasoning: { effort: "low", summary: "auto" },
      text: {
        format: {
          type: "json_schema",
          name: "viral_analysis_report",
          strict: true,
          schema: buildSchema(),
        },
      },
    }),
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("AI sedang sibuk. Coba lagi sebentar lagi.");
    if (res.status === 402)
      throw new Error("Kredit AI workspace habis. Tambahkan kredit untuk melanjutkan analisis.");
    throw new Error(`Analisis AI gagal (${res.status}). ${detail.slice(0, 300)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";

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
        const evt = JSON.parse(payload) as {
          type?: string;
          delta?: string;
          response?: { output_text?: string };
        };
        if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") {
          text += evt.delta;
        } else if (evt.type === "response.completed" && evt.response?.output_text) {
          if (!text) text = evt.response.output_text;
        }
      } catch {
        // ignore keep-alive / partial frames
      }
    }
  }

  if (!text.trim()) throw new Error("AI tidak mengembalikan hasil analisis. Coba ulangi.");

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("Format hasil analisis tidak valid. Coba ulangi analisis.");
  }

  const result = Object.fromEntries(
    FIELDS.map((f) => [f, typeof parsed[f] === "string" ? (parsed[f] as string) : ""]),
  ) as ViralAnalysisResult;

  return { result, model };
}

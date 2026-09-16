const MODEL = "openai/gpt-6-astra";

export type BrandDraft = {
  positioning: string;
  description: string;
  mission: string;
  audience: string;
  customer_problem: string;
  customer_desire: string;
  tone_of_voice: string;
  personality: string;
  writing_style: string;
  visual_direction: string;
  preferred_style: string;
  forbidden_style: string;
  products: Array<{ name: string; category: string; description: string; benefit: string }>;
  rules: Array<{ rule: string; rule_category: "allow" | "forbidden" | "claim_control" }>;
  power_words: Array<{ word: string; category: string; usage_example: string }>;
};

const TEXT = { type: "string" } as const;

const DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "positioning", "description", "mission", "audience", "customer_problem", "customer_desire",
    "tone_of_voice", "personality", "writing_style", "visual_direction", "preferred_style",
    "forbidden_style", "products", "rules", "power_words",
  ],
  properties: {
    positioning: TEXT,
    description: TEXT,
    mission: TEXT,
    audience: TEXT,
    customer_problem: TEXT,
    customer_desire: TEXT,
    tone_of_voice: TEXT,
    personality: TEXT,
    writing_style: TEXT,
    visual_direction: TEXT,
    preferred_style: TEXT,
    forbidden_style: TEXT,
    products: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "category", "description", "benefit"],
        properties: { name: TEXT, category: TEXT, description: TEXT, benefit: TEXT },
      },
    },
    rules: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["rule", "rule_category"],
        properties: {
          rule: TEXT,
          rule_category: { type: "string", enum: ["allow", "forbidden", "claim_control"] },
        },
      },
    },
    power_words: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["word", "category", "usage_example"],
        properties: { word: TEXT, category: TEXT, usage_example: TEXT },
      },
    },
  },
} as const;

export async function generateBrandDraft(input: {
  brand_name: string;
  existing: Record<string, string>;
  empty_fields: string[];
  source_context: unknown;
}): Promise<{ result: BrandDraft; model: string }> {
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
      instructions: [
        "Kamu membantu menyusun DRAFT Brand Knowledge untuk direview manusia.",
        "Draft hanya untuk field yang masih kosong. Untuk field yang sudah diisi user, salin nilainya apa adanya tanpa mengubah.",
        "DILARANG mengarang nama produk nyata, harga, promo, testimoni, angka performa, atau data bisnis. Rekomendasi produk hanya boleh berupa kategori/arah umum bila tidak ada data produk.",
        "Gunakan konteks brand dan konteks source yang tersedia. Jika informasi tidak tersedia, tulis arahan umum yang aman dan bisa diedit user.",
        "Buat minimal tiga power words. Jawab ringkas dalam Bahasa Indonesia.",
      ].join(" "),
      input: [
        `Nama brand: ${input.brand_name}`,
        `Field yang masih kosong: ${input.empty_fields.join(", ") || "tidak ada"}`,
        `Brand Knowledge existing: ${JSON.stringify(input.existing)}`,
        `Konteks source yang dianalisis user: ${JSON.stringify(input.source_context).slice(0, 10000)}`,
      ].join("\n\n"),
      stream: true,
      reasoning: { effort: "low", summary: "auto" },
      text: { format: { type: "json_schema", name: "brand_draft", strict: true, schema: DRAFT_SCHEMA } },
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
  if (!output.trim()) throw new Error("Lovable AI tidak mengembalikan draft brand.");
  try {
    return { result: JSON.parse(output) as BrandDraft, model: MODEL };
  } catch {
    throw new Error("Format draft Lovable AI tidak valid. Jalankan ulang.");
  }
}

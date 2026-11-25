import { routeStructured } from "./ai-router.server";

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
  return routeStructured<BrandDraft>({
    capability: "BRAND_KNOWLEDGE",
    name: "brand_draft", schema: DRAFT_SCHEMA,
    instructions: [
        "Kamu membantu menyusun DRAFT Brand Knowledge untuk direview manusia.",
        "Draft hanya untuk field yang masih kosong. Untuk field yang sudah diisi user, salin nilainya apa adanya tanpa mengubah.",
        "DILARANG mengarang nama produk nyata, harga, promo, testimoni, angka performa, atau data bisnis. Rekomendasi produk hanya boleh berupa kategori/arah umum bila tidak ada data produk.",
        "Gunakan konteks brand dan konteks source yang tersedia. Jika informasi tidak tersedia, tulis arahan umum yang aman dan bisa diedit user.",
        "Buat minimal tiga power words. Jawab ringkas dalam Bahasa Indonesia.",
      ].join(" "),
    prompt: [
        `Nama brand: ${input.brand_name}`,
        `Field yang masih kosong: ${input.empty_fields.join(", ") || "tidak ada"}`,
        `Brand Knowledge existing: ${JSON.stringify(input.existing)}`,
        `Konteks source yang dianalisis user: ${JSON.stringify(input.source_context).slice(0, 10000)}`,
      ].join("\n\n"),
  });
}

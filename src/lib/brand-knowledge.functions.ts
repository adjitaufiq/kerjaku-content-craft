import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BrandProfile = {
  brand_name: string;
  positioning: string;
  description: string;
  audience: string;
  customer_problem: string;
  customer_desire: string;
  tone_of_voice: string;
  personality: string;
  writing_style: string;
  mission: string;
  visual_direction: string;
  preferred_style: string;
  forbidden_style: string;
  version: string;
};

export type BrandProduct = {
  name: string;
  category: string;
  description: string;
  benefit: string;
  features: string[];
  target_user: string;
  allowed_claims: string[];
  forbidden_claims: string[];
  status: "active" | "inactive";
};

export type BrandRule = {
  rule: string;
  rule_type: "do" | "dont";
  rule_category: "allow" | "forbidden" | "claim_control";
  severity: "warning" | "hard_fail";
};

export type BrandPowerWord = {
  word: string;
  context: string;
  category: string;
  usage_example: string;
  forbidden_usage: string;
};

export type BrandReadiness = {
  status: "ready" | "incomplete";
  score: number;
  missing: string[];
  sections: { profile: number; products: number; rules: number; power_words: number };
};

export type BrandKnowledge = {
  profile: BrandProfile;
  products: BrandProduct[];
  rules: BrandRule[];
  power_words: BrandPowerWord[];
  readiness: BrandReadiness;
};

const EMPTY_PROFILE: BrandProfile = {
  brand_name: "@kerjaku.space",
  positioning: "",
  description: "",
  audience: "",
  customer_problem: "",
  customer_desire: "",
  tone_of_voice: "",
  personality: "",
  writing_style: "",
  mission: "",
  visual_direction: "",
  preferred_style: "",
  forbidden_style: "",
  version: "v1",
};

const CORE_PROFILE_FIELDS: Array<[keyof BrandProfile, string]> = [
  ["positioning", "Positioning"],
  ["audience", "Audience"],
  ["customer_problem", "Customer problem"],
  ["customer_desire", "Customer desire"],
  ["tone_of_voice", "Tone of voice"],
  ["writing_style", "Writing style"],
];

export function evaluateReadiness(
  profile: BrandProfile,
  products: BrandProduct[],
  rules: BrandRule[],
  powerWords: BrandPowerWord[],
): BrandReadiness {
  const missing: string[] = [];
  const filledCore = CORE_PROFILE_FIELDS.filter(([key, label]) => {
    const ok = String(profile[key] ?? "").trim().length > 0;
    if (!ok) missing.push(`Profil: ${label} belum diisi`);
    return ok;
  }).length;

  const activeProducts = products.filter((p) => p.status === "active" && p.name.trim());
  if (!activeProducts.length) missing.push("Minimal 1 produk aktif");

  const forbidden = rules.filter((r) => r.rule_category === "forbidden" && r.rule.trim());
  if (!forbidden.length) missing.push("Minimal 1 aturan forbidden");

  const words = powerWords.filter((w) => w.word.trim());
  if (words.length < 3) missing.push("Minimal 3 power words");

  const sections = {
    profile: Math.round((filledCore / CORE_PROFILE_FIELDS.length) * 100),
    products: activeProducts.length ? 100 : 0,
    rules: forbidden.length ? 100 : 0,
    power_words: Math.min(100, Math.round((words.length / 3) * 100)),
  };
  const score = Math.round(
    (sections.profile + sections.products + sections.rules + sections.power_words) / 4,
  );

  return { status: missing.length ? "incomplete" : "ready", score, missing, sections };
}

const asArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((v) => String(v)).filter((v) => v.trim()) : [];

export const getBrandKnowledge = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BrandKnowledge> => {
    const [profile, products, rules, words] = await Promise.all([
      context.supabase.from("brand_profile").select("*").maybeSingle(),
      context.supabase.from("brand_products").select("*").order("created_at"),
      context.supabase.from("brand_rules").select("*").order("created_at"),
      context.supabase.from("brand_power_words").select("*").order("created_at"),
    ]);
    const error = profile.error ?? products.error ?? rules.error ?? words.error;
    if (error) throw new Error(error.message);

    const p = profile.data as Record<string, unknown> | null;
    const nextProfile: BrandProfile = p
      ? {
          brand_name: String(p['brand_name'] ?? EMPTY_PROFILE.brand_name),
          positioning: String(p['positioning'] ?? ""),
          description: String(p['description'] ?? ""),
          audience: String(p['audience'] ?? ""),
          customer_problem: String(p['customer_problem'] ?? ""),
          customer_desire: String(p['customer_desire'] ?? ""),
          tone_of_voice: String(p['tone_of_voice'] ?? ""),
          personality: String(p['personality'] ?? ""),
          writing_style: String(p['writing_style'] ?? ""),
          mission: String(p['mission'] ?? ""),
          visual_direction: String(p['visual_direction'] ?? ""),
          preferred_style: String(p['preferred_style'] ?? ""),
          forbidden_style: String(p['forbidden_style'] ?? ""),
          version: String(p['version'] ?? "v1"),
        }
      : EMPTY_PROFILE;

    const nextProducts: BrandProduct[] = (products.data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        name: String(r['name'] ?? ""),
        category: String(r['category'] ?? ""),
        description: String(r['description'] ?? ""),
        benefit: String(r['benefit'] ?? ""),
        features: asArray(r['features']),
        target_user: String(r['target_user'] ?? ""),
        allowed_claims: asArray(r['allowed_claims']),
        forbidden_claims: asArray(r['forbidden_claims']),
        status: r['status'] === "inactive" ? "inactive" : "active",
      };
    });

    const nextRules: BrandRule[] = (rules.data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      const category = String(r['rule_category'] ?? "allow");
      return {
        rule: String(r['rule'] ?? ""),
        rule_type: r['rule_type'] === "dont" ? "dont" : "do",
        rule_category:
          category === "forbidden" || category === "claim_control"
            ? (category as BrandRule["rule_category"])
            : "allow",
        severity: r['severity'] === "hard_fail" ? "hard_fail" : "warning",
      };
    });

    const nextWords: BrandPowerWord[] = (words.data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        word: String(r['word'] ?? ""),
        context: String(r['context'] ?? ""),
        category: String(r['category'] ?? ""),
        usage_example: String(r['usage_example'] ?? ""),
        forbidden_usage: String(r['forbidden_usage'] ?? ""),
      };
    });

    return {
      profile: nextProfile,
      products: nextProducts,
      rules: nextRules,
      power_words: nextWords,
      readiness: evaluateReadiness(nextProfile, nextProducts, nextRules, nextWords),
    };
  });

export type BrandKnowledgeInput = Omit<BrandKnowledge, "readiness">;

export const saveBrandKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: BrandKnowledgeInput) => input)
  .handler(async ({ data, context }) => {
    const clean = (value: string) => String(value ?? "").trim();
    const cleanList = (value: string[]) => (value ?? []).map(clean).filter(Boolean);
    const version = `v${Date.now()}`;

    const profile = {
      user_id: context.userId,
      brand_name: clean(data.profile.brand_name) || "@kerjaku.space",
      positioning: clean(data.profile.positioning),
      description: clean(data.profile.description),
      audience: clean(data.profile.audience),
      customer_problem: clean(data.profile.customer_problem),
      customer_desire: clean(data.profile.customer_desire),
      tone_of_voice: clean(data.profile.tone_of_voice),
      personality: clean(data.profile.personality),
      writing_style: clean(data.profile.writing_style),
      mission: clean(data.profile.mission),
      visual_direction: clean(data.profile.visual_direction),
      preferred_style: clean(data.profile.preferred_style),
      forbidden_style: clean(data.profile.forbidden_style),
      version,
    };
    const { error: profileError } = await context.supabase
      .from("brand_profile")
      .upsert(profile, { onConflict: "user_id" });
    if (profileError) throw new Error(profileError.message);

    for (const table of ["brand_products", "brand_rules", "brand_power_words"] as const) {
      const { error } = await context.supabase.from(table).delete().eq("user_id", context.userId);
      if (error) throw new Error(error.message);
    }

    const products = data.products
      .filter((item) => clean(item.name))
      .map((item) => ({
        user_id: context.userId,
        name: clean(item.name),
        category: clean(item.category),
        description: clean(item.description),
        benefit: clean(item.benefit),
        features: cleanList(item.features),
        target_user: clean(item.target_user),
        allowed_claims: cleanList(item.allowed_claims),
        forbidden_claims: cleanList(item.forbidden_claims),
        status: item.status === "inactive" ? "inactive" : "active",
      }));
    if (products.length) {
      const { error } = await context.supabase.from("brand_products").insert(products);
      if (error) throw new Error(error.message);
    }

    const rules = data.rules
      .filter((item) => clean(item.rule))
      .map((item) => ({
        user_id: context.userId,
        rule: clean(item.rule),
        rule_type: item.rule_category === "forbidden" ? "dont" : "do",
        rule_category: item.rule_category,
        severity: item.severity,
      }));
    if (rules.length) {
      const { error } = await context.supabase.from("brand_rules").insert(rules);
      if (error) throw new Error(error.message);
    }

    const words = data.power_words
      .filter((item) => clean(item.word))
      .map((item) => ({
        user_id: context.userId,
        word: clean(item.word),
        context: clean(item.context),
        category: clean(item.category),
        usage_example: clean(item.usage_example),
        forbidden_usage: clean(item.forbidden_usage),
      }));
    if (words.length) {
      const { error } = await context.supabase.from("brand_power_words").insert(words);
      if (error) throw new Error(error.message);
    }

    const readiness = evaluateReadiness(
      { ...data.profile, version },
      data.products,
      data.rules,
      data.power_words,
    );

    const snapshot = {
      profile,
      products,
      rules,
      power_words: words,
      readiness,
    };
    const { error: versionError } = await context.supabase
      .from("brand_knowledge_versions")
      .insert({
        user_id: context.userId,
        version,
        snapshot: JSON.parse(JSON.stringify(snapshot)),
        readiness: readiness.status,
      });
    if (versionError) throw new Error(versionError.message);

    return { ok: true, version, readiness };
  });

/** Official Brand Context reader for the ATM engine. */
export const getBrandContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const knowledge = await getBrandKnowledge({ signal: undefined as never }).catch(() => null);
    if (knowledge) return knowledge;
    const { data } = await context.supabase.from("brand_profile").select("*").maybeSingle();
    void data;
    throw new Error("Brand Knowledge tidak dapat dibaca.");
  });

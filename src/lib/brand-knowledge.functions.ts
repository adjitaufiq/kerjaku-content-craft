import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BrandKnowledge = {
  profile: {
    brand_name: string;
    positioning: string;
    audience: string;
    tone_of_voice: string;
    mission: string;
    version: string;
  };
  products: Array<{ name: string; description: string; benefit: string }>;
  rules: Array<{ rule: string; rule_type: "do" | "dont" }>;
  power_words: Array<{ word: string; context: string }>;
};

const EMPTY: BrandKnowledge = {
  profile: {
    brand_name: "@kerjaku.space",
    positioning: "",
    audience: "",
    tone_of_voice: "",
    mission: "",
    version: "v1",
  },
  products: [],
  rules: [],
  power_words: [],
};

export const getBrandKnowledge = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BrandKnowledge> => {
    const [profile, products, rules, words] = await Promise.all([
      context.supabase.from("brand_profile").select("*").maybeSingle(),
      context.supabase.from("brand_products").select("name,description,benefit").order("created_at"),
      context.supabase.from("brand_rules").select("rule,rule_type").order("created_at"),
      context.supabase.from("brand_power_words").select("word,context").order("created_at"),
    ]);
    const error = profile.error ?? products.error ?? rules.error ?? words.error;
    if (error) throw new Error(error.message);
    return {
      profile: profile.data
        ? {
            brand_name: profile.data.brand_name,
            positioning: profile.data.positioning,
            audience: profile.data.audience,
            tone_of_voice: profile.data.tone_of_voice,
            mission: profile.data.mission,
            version: profile.data.version,
          }
        : EMPTY.profile,
      products: products.data ?? [],
      rules: (rules.data ?? []).map((row) => ({
        rule: row.rule,
        rule_type: row.rule_type === "dont" ? "dont" : "do",
      })),
      power_words: words.data ?? [],
    };
  });

export const saveBrandKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: BrandKnowledge) => input)
  .handler(async ({ data, context }) => {
    const clean = (value: string) => value.trim();
    const version = `v${Date.now()}`;
    const profile = {
      user_id: context.userId,
      brand_name: clean(data.profile.brand_name) || "@kerjaku.space",
      positioning: clean(data.profile.positioning),
      audience: clean(data.profile.audience),
      tone_of_voice: clean(data.profile.tone_of_voice),
      mission: clean(data.profile.mission),
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

    if (data.products.length) {
      const { error } = await context.supabase.from("brand_products").insert(
        data.products
          .filter((item) => clean(item.name))
          .map((item) => ({
            user_id: context.userId,
            name: clean(item.name),
            description: clean(item.description),
            benefit: clean(item.benefit),
          })),
      );
      if (error) throw new Error(error.message);
    }
    if (data.rules.length) {
      const { error } = await context.supabase.from("brand_rules").insert(
        data.rules
          .filter((item) => clean(item.rule))
          .map((item) => ({ user_id: context.userId, rule: clean(item.rule), rule_type: item.rule_type })),
      );
      if (error) throw new Error(error.message);
    }
    if (data.power_words.length) {
      const { error } = await context.supabase.from("brand_power_words").insert(
        data.power_words
          .filter((item) => clean(item.word))
          .map((item) => ({ user_id: context.userId, word: clean(item.word), context: clean(item.context) })),
      );
      if (error) throw new Error(error.message);
    }
    return { ok: true, version };
  });

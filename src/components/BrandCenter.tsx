import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, CheckCircle2, Loader2, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  evaluateReadiness,
  generateBrandKnowledgeDraft,
  getBrandKnowledge,
  saveBrandKnowledge,
  type BrandKnowledgeInput,
  type BrandPowerWord,
  type BrandProduct,
  type BrandProfile,
  type BrandRule,
} from "@/lib/brand-knowledge.functions";


const EMPTY: BrandKnowledgeInput = {
  profile: {
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
  },
  products: [],
  rules: [],
  power_words: [],
};

const NEW_PRODUCT: BrandProduct = {
  name: "",
  category: "",
  description: "",
  benefit: "",
  features: [],
  target_user: "",
  allowed_claims: [],
  forbidden_claims: [],
  status: "active",
};

const NEW_RULE: BrandRule = {
  rule: "",
  rule_type: "do",
  rule_category: "allow",
  severity: "warning",
};

const NEW_WORD: BrandPowerWord = {
  word: "",
  context: "",
  category: "",
  usage_example: "",
  forbidden_usage: "",
};

const listToText = (value: string[]) => value.join(", ");
const textToList = (value: string) =>
  value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

export function BrandCenter() {
  const queryClient = useQueryClient();
  const load = useServerFn(getBrandKnowledge);
  const save = useServerFn(saveBrandKnowledge);
  const query = useQuery({ queryKey: ["brand-knowledge"], queryFn: () => load({}) });
  const [form, setForm] = useState<BrandKnowledgeInput>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (query.data) {
      const { readiness: _readiness, ...rest } = query.data;
      setForm(rest);
    }
  }, [query.data]);

  const readiness = evaluateReadiness(form.profile, form.products, form.rules, form.power_words);

  function setProfile(key: keyof BrandProfile, value: string) {
    setForm((current) => ({ ...current, profile: { ...current.profile, [key]: value } }));
  }
  function patchProduct(index: number, patch: Partial<BrandProduct>) {
    setForm((c) => ({
      ...c,
      products: c.products.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
  }
  function patchRule(index: number, patch: Partial<BrandRule>) {
    setForm((c) => ({
      ...c,
      rules: c.rules.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
  }
  function patchWord(index: number, patch: Partial<BrandPowerWord>) {
    setForm((c) => ({
      ...c,
      power_words: c.power_words.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await save({ data: form });
      await queryClient.invalidateQueries({ queryKey: ["brand-knowledge"] });
      toast.success(
        result.readiness.status === "ready"
          ? "Brand Knowledge tersimpan dan siap dipakai Creative ATM."
          : "Brand Knowledge tersimpan, tetapi masih ada bagian yang belum lengkap.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Brand Knowledge gagal disimpan.");
    } finally {
      setSaving(false);
  }

  async function generateDraft() {
    setDrafting(true);
    try {
      const draft = await makeDraft({ data: { profile: form.profile } });
      setForm((current) => {
        const profile = { ...current.profile };
        (Object.keys(profile) as Array<keyof BrandProfile>).forEach((key) => {
          const suggestion = (draft as unknown as Record<string, unknown>)[key as string];
          if (!String(profile[key] ?? "").trim() && typeof suggestion === "string" && suggestion.trim()) {
            profile[key] = suggestion.trim();
          }
        });
        return {
          ...current,
          profile,
          products: current.products.length
            ? current.products
            : draft.products.map((item) => ({ ...NEW_PRODUCT, ...item })),
          rules: current.rules.length
            ? current.rules
            : draft.rules.map((item) => ({ ...NEW_RULE, ...item })),
          power_words: current.power_words.length
            ? current.power_words
            : draft.power_words.map((item) => ({ ...NEW_WORD, ...item })),
        };
      });
      toast.success("Draft AI dimuat ke form. Periksa dan edit sebelum menyimpan.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Draft brand gagal dibuat.");
    } finally {
      setDrafting(false);
    }
  }

  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="surface-panel space-y-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 font-display text-lg font-semibold">
              <BookOpen className="size-4 text-primary" /> Brand Center
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Sumber fakta brand untuk ATM Engine. Setiap simpan membuat versi baru.
            </p>
          </div>
          <Button type="submit" disabled={saving || query.isLoading}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            Simpan Brand Knowledge
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <ScoreCard label="Profile" value={readiness.sections.profile} />
          <ScoreCard label="Products" value={readiness.sections.products} />
          <ScoreCard label="Rules" value={readiness.sections.rules} />
          <ScoreCard label="Power Words" value={readiness.sections.power_words} />
        </div>

        <div className="rounded-xl border border-border/60 bg-secondary/30 p-4 text-sm">
          <p className="flex items-center gap-2 font-medium">
            {readiness.level === "COMPLETE" ? (
              <CheckCircle2 className="size-4 text-primary" />
            ) : (
              <BookOpen className="size-4 text-muted-foreground" />
            )}
            Brand Readiness: {readiness.percentage}% —{" "}
            {readiness.level === "COMPLETE"
              ? "Brand Ready"
              : readiness.level === "EMPTY"
                ? "Empty"
                : "Partial"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {readiness.level === "COMPLETE"
              ? "Brand Center dipakai sebagai konteks utama ATM."
              : "ATM tetap dapat dibuat. Bagian yang kosong akan dilengkapi konteks source dan asumsi AI."}
          </p>
          {readiness.missing_fields.length ? (
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
              {readiness.missing_fields.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>

      </div>

      <Tabs defaultValue="profile" className="surface-panel p-6">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="words">Power Words</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6 space-y-6">
          <Group title="Identity">
            <Field label="Brand" value={form.profile.brand_name} onChange={(v) => setProfile("brand_name", v)} />
            <Field label="Positioning" value={form.profile.positioning} onChange={(v) => setProfile("positioning", v)} />
            <Area label="Deskripsi brand" value={form.profile.description} onChange={(v) => setProfile("description", v)} />
            <Area label="Mission" value={form.profile.mission} onChange={(v) => setProfile("mission", v)} />
          </Group>
          <Group title="Audience">
            <Area label="Audience" value={form.profile.audience} onChange={(v) => setProfile("audience", v)} />
            <Area label="Masalah pelanggan" value={form.profile.customer_problem} onChange={(v) => setProfile("customer_problem", v)} />
            <Area label="Keinginan pelanggan" value={form.profile.customer_desire} onChange={(v) => setProfile("customer_desire", v)} />
          </Group>
          <Group title="Communication">
            <Area label="Tone of voice" value={form.profile.tone_of_voice} onChange={(v) => setProfile("tone_of_voice", v)} />
            <Area label="Personality" value={form.profile.personality} onChange={(v) => setProfile("personality", v)} />
            <Area label="Writing style" value={form.profile.writing_style} onChange={(v) => setProfile("writing_style", v)} />
          </Group>
          <Group title="Visual">
            <Area label="Arah visual" value={form.profile.visual_direction} onChange={(v) => setProfile("visual_direction", v)} />
            <Area label="Gaya disukai" value={form.profile.preferred_style} onChange={(v) => setProfile("preferred_style", v)} />
            <Area label="Gaya terlarang" value={form.profile.forbidden_style} onChange={(v) => setProfile("forbidden_style", v)} />
          </Group>
        </TabsContent>

        <TabsContent value="products" className="mt-6 space-y-4">
          <SectionHeader
            title="Produk / layanan"
            addLabel="Tambah produk"
            onAdd={() => setForm((c) => ({ ...c, products: [...c.products, { ...NEW_PRODUCT }] }))}
          />
          {form.products.length === 0 ? <Empty text="Belum ada produk." /> : null}
          {form.products.map((item, index) => (
            <div key={index} className="space-y-3 rounded-xl border border-border/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    item.status === "active"
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {item.status === "active" ? "Active" : "Inactive"}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      patchProduct(index, { status: item.status === "active" ? "inactive" : "active" })
                    }
                  >
                    {item.status === "active" ? "Nonaktifkan" : "Aktifkan"}
                  </Button>
                  <RemoveButton
                    label="Hapus produk"
                    onClick={() =>
                      setForm((c) => ({ ...c, products: c.products.filter((_, i) => i !== index) }))
                    }
                  />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Nama" value={item.name} onChange={(v) => patchProduct(index, { name: v })} />
                <Field label="Kategori" value={item.category} onChange={(v) => patchProduct(index, { category: v })} />
                <Area label="Deskripsi" value={item.description} onChange={(v) => patchProduct(index, { description: v })} />
                <Area label="Manfaat" value={item.benefit} onChange={(v) => patchProduct(index, { benefit: v })} />
                <Field label="Target pengguna" value={item.target_user} onChange={(v) => patchProduct(index, { target_user: v })} />
                <Field
                  label="Fitur (pisahkan dengan koma)"
                  value={listToText(item.features)}
                  onChange={(v) => patchProduct(index, { features: textToList(v) })}
                />
                <Field
                  label="Klaim yang boleh (koma)"
                  value={listToText(item.allowed_claims)}
                  onChange={(v) => patchProduct(index, { allowed_claims: textToList(v) })}
                />
                <Field
                  label="Klaim terlarang (koma)"
                  value={listToText(item.forbidden_claims)}
                  onChange={(v) => patchProduct(index, { forbidden_claims: textToList(v) })}
                />
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="rules" className="mt-6 space-y-4">
          <SectionHeader
            title="Aturan brand"
            addLabel="Tambah aturan"
            onAdd={() => setForm((c) => ({ ...c, rules: [...c.rules, { ...NEW_RULE }] }))}
          />
          {form.rules.length === 0 ? <Empty text="Belum ada aturan." /> : null}
          {form.rules.map((item, index) => (
            <div
              key={index}
              className="grid gap-2 rounded-xl border border-border/60 p-3 md:grid-cols-[160px_150px_1fr_auto]"
            >
              <Select
                label={`Kategori aturan ${index + 1}`}
                value={item.rule_category}
                onChange={(v) => patchRule(index, { rule_category: v as BrandRule["rule_category"] })}
                options={[
                  ["allow", "Allow"],
                  ["forbidden", "Forbidden"],
                  ["claim_control", "Claim Control"],
                ]}
              />
              <Select
                label={`Severity aturan ${index + 1}`}
                value={item.severity}
                onChange={(v) => patchRule(index, { severity: v as BrandRule["severity"] })}
                options={[
                  ["warning", "Warning"],
                  ["hard_fail", "Hard fail"],
                ]}
              />
              <Input
                aria-label={`Aturan ${index + 1}`}
                placeholder="Isi aturan"
                value={item.rule}
                onChange={(e) => patchRule(index, { rule: e.target.value })}
              />
              <RemoveButton
                label="Hapus aturan"
                onClick={() => setForm((c) => ({ ...c, rules: c.rules.filter((_, i) => i !== index) }))}
              />
            </div>
          ))}
        </TabsContent>

        <TabsContent value="words" className="mt-6 space-y-4">
          <SectionHeader
            title="Power words"
            addLabel="Tambah power word"
            onAdd={() => setForm((c) => ({ ...c, power_words: [...c.power_words, { ...NEW_WORD }] }))}
          />
          {form.power_words.length === 0 ? <Empty text="Belum ada power word." /> : null}
          {form.power_words.map((item, index) => (
            <div
              key={index}
              className="grid gap-2 rounded-xl border border-border/60 p-3 md:grid-cols-[1fr_1fr_1.5fr_1.5fr_auto]"
            >
              <Input aria-label={`Power word ${index + 1}`} placeholder="Kata" value={item.word} onChange={(e) => patchWord(index, { word: e.target.value })} />
              <Input aria-label={`Kategori power word ${index + 1}`} placeholder="Kategori" value={item.category} onChange={(e) => patchWord(index, { category: e.target.value })} />
              <Input aria-label={`Contoh pemakaian ${index + 1}`} placeholder="Contoh pemakaian" value={item.usage_example} onChange={(e) => patchWord(index, { usage_example: e.target.value })} />
              <Input aria-label={`Pemakaian terlarang ${index + 1}`} placeholder="Pemakaian terlarang" value={item.forbidden_usage} onChange={(e) => patchWord(index, { forbidden_usage: e.target.value })} />
              <RemoveButton
                label="Hapus power word"
                onClick={() =>
                  setForm((c) => ({ ...c, power_words: c.power_words.filter((_, i) => i !== index) }))
                }
              />
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </form>
  );
}

function ScoreCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/60 p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-display text-lg font-semibold">{value}%</p>
    </div>
  );
}
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
function Area({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <select
      aria-label={label}
      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}
function SectionHeader({ title, addLabel, onAdd }: { title: string; addLabel: string; onAdd: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <Button type="button" variant="outline" size="sm" onClick={onAdd}>
        <Plus />
        {addLabel}
      </Button>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground">{text}</p>;
}
function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="icon" aria-label={label} title={label} onClick={onClick}>
      <Trash2 />
    </Button>
  );
}

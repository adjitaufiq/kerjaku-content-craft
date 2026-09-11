import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getBrandKnowledge,
  saveBrandKnowledge,
  type BrandKnowledge,
} from "@/lib/brand-knowledge.functions";

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

export function BrandKnowledgeEditor() {
  const queryClient = useQueryClient();
  const load = useServerFn(getBrandKnowledge);
  const save = useServerFn(saveBrandKnowledge);
  const query = useQuery({ queryKey: ["brand-knowledge"], queryFn: () => load({}) });
  const [form, setForm] = useState<BrandKnowledge>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (query.data) setForm(query.data);
  }, [query.data]);

  function setProfile(key: keyof BrandKnowledge["profile"], value: string) {
    setForm((current) => ({ ...current, profile: { ...current.profile, [key]: value } }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await save({ data: form });
      await queryClient.invalidateQueries({ queryKey: ["brand-knowledge"] });
      toast.success("Brand Knowledge tersimpan dan siap dipakai ATM Engine.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Brand Knowledge gagal disimpan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="surface-panel space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-semibold">
            <BookOpen className="size-4 text-primary" /> Brand Knowledge
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Sumber aturan brand untuk ATM Engine. Perubahan menghasilkan versi baru.
          </p>
        </div>
        <Button type="submit" disabled={saving || query.isLoading}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />}
          Simpan Brand Knowledge
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Brand" value={form.profile.brand_name} onChange={(v) => setProfile("brand_name", v)} />
        <Field label="Positioning" value={form.profile.positioning} onChange={(v) => setProfile("positioning", v)} />
        <Area label="Audience" value={form.profile.audience} onChange={(v) => setProfile("audience", v)} />
        <Area label="Tone of voice" value={form.profile.tone_of_voice} onChange={(v) => setProfile("tone_of_voice", v)} />
        <div className="md:col-span-2">
          <Area label="Mission" value={form.profile.mission} onChange={(v) => setProfile("mission", v)} />
        </div>
      </div>

      <ListSection
        title="Produk / layanan"
        addLabel="Tambah produk"
        onAdd={() => setForm((c) => ({ ...c, products: [...c.products, { name: "", description: "", benefit: "" }] }))}
      >
        {form.products.map((item, index) => (
          <div key={index} className="grid gap-2 border-b border-border/60 pb-3 md:grid-cols-[1fr_1.5fr_1.5fr_auto]">
            <Input aria-label={`Nama produk ${index + 1}`} placeholder="Nama" value={item.name} onChange={(e) => setForm((c) => ({ ...c, products: c.products.map((row, i) => i === index ? { ...row, name: e.target.value } : row) }))} />
            <Input aria-label={`Deskripsi produk ${index + 1}`} placeholder="Deskripsi" value={item.description} onChange={(e) => setForm((c) => ({ ...c, products: c.products.map((row, i) => i === index ? { ...row, description: e.target.value } : row) }))} />
            <Input aria-label={`Manfaat produk ${index + 1}`} placeholder="Manfaat" value={item.benefit} onChange={(e) => setForm((c) => ({ ...c, products: c.products.map((row, i) => i === index ? { ...row, benefit: e.target.value } : row) }))} />
            <RemoveButton label="Hapus produk" onClick={() => setForm((c) => ({ ...c, products: c.products.filter((_, i) => i !== index) }))} />
          </div>
        ))}
      </ListSection>

      <div className="grid gap-6 lg:grid-cols-2">
        <ListSection title="Aturan brand" addLabel="Tambah aturan" onAdd={() => setForm((c) => ({ ...c, rules: [...c.rules, { rule: "", rule_type: "do" }] }))}>
          {form.rules.map((item, index) => (
            <div key={index} className="flex gap-2 border-b border-border/60 pb-3">
              <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={item.rule_type} onChange={(e) => setForm((c) => ({ ...c, rules: c.rules.map((row, i) => i === index ? { ...row, rule_type: e.target.value === "dont" ? "dont" : "do" } : row) }))}>
                <option value="do">Do</option><option value="dont">Don't</option>
              </select>
              <Input aria-label={`Aturan ${index + 1}`} placeholder="Aturan brand" value={item.rule} onChange={(e) => setForm((c) => ({ ...c, rules: c.rules.map((row, i) => i === index ? { ...row, rule: e.target.value } : row) }))} />
              <RemoveButton label="Hapus aturan" onClick={() => setForm((c) => ({ ...c, rules: c.rules.filter((_, i) => i !== index) }))} />
            </div>
          ))}
        </ListSection>
        <ListSection title="Power words" addLabel="Tambah power word" onAdd={() => setForm((c) => ({ ...c, power_words: [...c.power_words, { word: "", context: "" }] }))}>
          {form.power_words.map((item, index) => (
            <div key={index} className="grid gap-2 border-b border-border/60 pb-3 sm:grid-cols-[1fr_2fr_auto]">
              <Input aria-label={`Power word ${index + 1}`} placeholder="Kata" value={item.word} onChange={(e) => setForm((c) => ({ ...c, power_words: c.power_words.map((row, i) => i === index ? { ...row, word: e.target.value } : row) }))} />
              <Input aria-label={`Konteks power word ${index + 1}`} placeholder="Kapan digunakan" value={item.context} onChange={(e) => setForm((c) => ({ ...c, power_words: c.power_words.map((row, i) => i === index ? { ...row, context: e.target.value } : row) }))} />
              <RemoveButton label="Hapus power word" onClick={() => setForm((c) => ({ ...c, power_words: c.power_words.filter((_, i) => i !== index) }))} />
            </div>
          ))}
        </ListSection>
      </div>
    </form>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <div className="space-y-2"><Label>{label}</Label><Input value={value} onChange={(e) => onChange(e.target.value)} /></div>;
}
function Area({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <div className="space-y-2"><Label>{label}</Label><Textarea value={value} onChange={(e) => onChange(e.target.value)} /></div>;
}
function ListSection({ title, addLabel, onAdd, children }: { title: string; addLabel: string; onAdd: () => void; children: React.ReactNode }) {
  return <section className="space-y-3"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">{title}</h3><Button type="button" variant="outline" size="sm" onClick={onAdd}><Plus />{addLabel}</Button></div><div className="space-y-3">{children}</div></section>;
}
function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <Button type="button" variant="ghost" size="icon" aria-label={label} title={label} onClick={onClick}><Trash2 /></Button>;
}

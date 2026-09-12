import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Brain, Loader2, ShieldAlert, Sparkles, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  generateKerjakuAtmVersion,
  getIntelligenceWorkspace,
  reviewKerjakuAtmVersion,
  runViralDnaAnalysis,
  type AtmMode,
  type AtmVersion,
  type DnaEvidence,
} from "@/lib/cliper-intelligence.functions";

export function CliperIntelligencePanel({ sourceId, gateAllowed }: { sourceId: string; gateAllowed: boolean }) {
  const queryClient = useQueryClient();
  const load = useServerFn(getIntelligenceWorkspace);
  const analyze = useServerFn(runViralDnaAnalysis);
  const generate = useServerFn(generateKerjakuAtmVersion);
  const review = useServerFn(reviewKerjakuAtmVersion);
  const query = useQuery({
    queryKey: ["cliper-intelligence", sourceId],
    queryFn: () => load({ data: { sourceId } }),
  });
  const [mode, setMode] = useState<AtmMode>("conservative");
  const [angle, setAngle] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["cliper-intelligence", sourceId] });
    await queryClient.invalidateQueries({ queryKey: ["source-detail", sourceId] });
    await queryClient.invalidateQueries({ queryKey: ["viral-sources"] });
  };

  const dnaMutation = useMutation({
    mutationFn: () => analyze({ data: { sourceId } }),
    onSuccess: async () => { await refresh(); toast.success("Viral DNA Analysis selesai."); },
    onError: (error: Error) => toast.error(error.message),
  });
  const atmMutation = useMutation({
    mutationFn: () => generate({ data: { sourceId, mode, angle } }),
    onSuccess: async () => { setAngle(""); await refresh(); toast.success("Versi ATM siap ditinjau."); },
    onError: (error: Error) => toast.error(error.message),
  });
  const reviewMutation = useMutation({
    mutationFn: (input: { version: AtmVersion; decision: "approved" | "rejected" }) => review({ data: { versionId: input.version.id, decision: input.decision, note: notes[input.version.id] ?? "" } }),
    onSuccess: async (_, input) => { await refresh(); toast.success(input.decision === "approved" ? "Versi ATM disetujui." : "Versi ATM dikembalikan untuk revisi."); },
    onError: (error: Error) => toast.error(error.message),
  });

  const dna = query.data?.dna ?? null;
  const versions = query.data?.versions ?? [];

  return (
    <section className="space-y-5 border-t border-border pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><Brain className="size-5 text-primary" /> Viral DNA & KERJAKU ATM</h2>
          <p className="mt-1 text-sm text-muted-foreground">Reverse engineering formula sumber, lalu adaptasi strategis sebelum produksi.</p>
        </div>
        <Button onClick={() => dnaMutation.mutate()} disabled={!gateAllowed || dnaMutation.isPending}>
          {dnaMutation.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {dna ? "Analisis Ulang DNA" : "Analisis Viral DNA"}
        </Button>
      </div>

      {!gateAllowed ? <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-400"><ShieldAlert className="size-4" /> Source Extraction belum lolos quality gate.</div> : null}

      {dna ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="surface-panel space-y-4 p-5">
            <div className="flex items-center justify-between gap-2"><h3 className="font-display font-semibold">Viral DNA Report</h3><div className="flex flex-wrap items-center gap-1"><Badge variant="outline">{dna.hook_type}</Badge>{dna.confidence_score ? <Badge variant="secondary">Keyakinan {Math.round(dna.confidence_score)}%</Badge> : null}</div></div>
            <div className="flex flex-wrap gap-1">{[dna.hook_category, dna.structure_category, dna.trigger_category].filter(Boolean).map((tag) => <Badge key={tag} variant="outline" className="text-[11px]">{tag.replace(/_/g, " ")}</Badge>)}</div>
            <DnaRow label="Hook" value={dna.hook} />
            <DnaRow label="Kenapa hook bekerja" value={dna.hook_reason} />
            <DnaRow label="Pattern interrupt" value={dna.pattern_interrupt} />
            <DnaRow label="Psychological trigger" value={dna.psychological_trigger} />
            <DnaRow label="Curiosity gap" value={dna.curiosity_gap} />
            <DnaRow label="Structure" value={dna.structure_type} />
            <DnaRow label="Retention" value={dna.retention_factor} />
            <DnaRow label="Engagement" value={dna.engagement_factor} />
            <DnaRow label="Pemicu simpan" value={dna.save_trigger} />
            <DnaRow label="Pemicu bagikan" value={dna.share_trigger} />
            <DnaRow label="Pemicu komentar" value={dna.comment_trigger} />
            <div><p className="text-xs font-semibold uppercase text-muted-foreground">Power words</p><div className="mt-2 flex flex-wrap gap-1">{dna.power_words.map((word) => <Badge key={word} variant="secondary">{word}</Badge>)}</div></div>
            <Evidence items={dna.evidence} />
          </div>

          <div className="surface-panel space-y-4 p-5">
            <div><h3 className="font-display font-semibold">ATM Engine</h3><p className="mt-1 text-xs text-muted-foreground">Pilih tingkat kedekatan formula dan tentukan angle yang akan ditinjau manusia.</p></div>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={mode === "conservative" ? "default" : "outline"} onClick={() => setMode("conservative")}>Conservative</Button>
              <Button type="button" variant={mode === "creative" ? "default" : "outline"} onClick={() => setMode("creative")}>Creative</Button>
            </div>
            <p className="text-xs text-muted-foreground">{mode === "conservative" ? "Mempertahankan formula dan urutan persuasi utama, dengan konteks KERJAKU yang orisinal." : "Mengambil prinsip viral, lalu mengubah angle dan arah storytelling lebih jauh."}</p>
            <div className="space-y-2"><Label htmlFor="atm-angle">Angle pilihan</Label><Textarea id="atm-angle" value={angle} onChange={(e) => setAngle(e.target.value)} placeholder="Contoh: Kesalahan kecil saat interview yang membuat kandidat terlihat tidak siap" /></div>
            <Button className="w-full" onClick={() => atmMutation.mutate()} disabled={atmMutation.isPending || !angle.trim()}>{atmMutation.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}Buat Arah ATM</Button>
            <p className="text-[11px] text-muted-foreground">Hasil hanya berupa arah strategi. Tidak membuat carousel, caption, storyboard, atau script.</p>
          </div>
        </div>
      ) : <div className="surface-panel p-6 text-sm text-muted-foreground">Belum ada Viral DNA. Jalankan analisis setelah Source Extraction lolos quality gate.</div>}

      {versions.length ? <div className="space-y-3"><h3 className="font-display text-sm font-semibold">Approval Checkpoint</h3>{versions.map((version) => <VersionReview key={version.id} version={version} note={notes[version.id] ?? ""} onNote={(value) => setNotes((current) => ({ ...current, [version.id]: value }))} onDecision={(decision) => reviewMutation.mutate({ version, decision })} busy={reviewMutation.isPending} />)}</div> : null}
    </section>
  );
}

function DnaRow({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-semibold uppercase text-primary">{label}</p><p className="mt-1 text-sm text-muted-foreground">{value || "—"}</p></div>; }
function Evidence({ items }: { items: DnaEvidence[] }) { if (!items.length) return null; return <div><p className="text-xs font-semibold uppercase text-muted-foreground">Bukti sumber</p><ul className="mt-2 space-y-1.5">{items.map((item, index) => <li key={`${item.timestamp}-${index}`} className="text-xs text-muted-foreground"><span className="font-mono text-primary">{item.timestamp}</span> · {item.quote}</li>)}</ul></div>; }
function VersionReview({ version, note, onNote, onDecision, busy }: { version: AtmVersion; note: string; onNote: (value: string) => void; onDecision: (value: "approved" | "rejected") => void; busy: boolean }) {
  const adaptation = version.adaptation;
  const mapping = version.source_mapping;
  return <article className="surface-panel space-y-4 p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><Badge>{version.atm_mode === "conservative" ? "Conservative" : "Creative"}</Badge><Badge variant="outline">{version.status.replace("_", " ")}</Badge></div><span className="text-xs text-muted-foreground">Brand {version.brand_profile_version}</span></div><div><p className="text-xs font-semibold uppercase text-primary">Angle</p><p className="mt-1 text-sm">{version.angle}</p></div><div className="grid gap-3 md:grid-cols-2"><DnaRow label="Premis strategis" value={adaptation.strategic_premise ?? ""} /><DnaRow label="Relevansi audience" value={adaptation.target_audience_relevance ?? ""} /><DnaRow label="Arah storytelling" value={adaptation.storytelling_direction ?? ""} /><DnaRow label="Arah brand voice" value={adaptation.brand_voice_direction ?? ""} /><DnaRow label="Koneksi produk" value={adaptation.product_connection ?? ""} /><DnaRow label="Alasan" value={version.reason} /></div><div className="grid gap-3 md:grid-cols-2"><BulletList label="Formula dipertahankan" items={mapping.preserved_formula ?? []} /><BulletList label="Elemen diubah" items={mapping.changed_elements ?? []} /><BulletList label="Originality safeguards" items={adaptation.originality_safeguards ?? []} /></div>{version.status === "pending_approval" ? <div className="space-y-3 border-t border-border pt-4"><div className="space-y-2"><Label htmlFor={`note-${version.id}`}>Catatan persetujuan / revisi</Label><Textarea id={`note-${version.id}`} value={note} onChange={(e) => onNote(e.target.value)} placeholder="Tambahkan arahan untuk tahap berikutnya" /></div><div className="flex flex-wrap gap-2"><Button onClick={() => onDecision("approved")} disabled={busy}><BadgeCheck />Setujui Arah</Button><Button variant="destructive" onClick={() => onDecision("rejected")} disabled={busy || !note.trim()}><XCircle />Tolak & Minta Revisi</Button></div></div> : <div className={`flex items-center gap-2 text-sm ${version.status === "approved" ? "text-accent" : "text-destructive"}`}>{version.status === "approved" ? <BadgeCheck className="size-4" /> : <XCircle className="size-4" />}<span>{version.status === "approved" ? "Disetujui untuk masuk tahap produksi berikutnya." : `Ditolak: ${version.approval_note}`}</span></div>}</article>;
}
function BulletList({ label, items }: { label: string; items: string[] }) { if (!items.length) return null; return <div><p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p><ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-muted-foreground">{items.map((item) => <li key={item}>{item}</li>)}</ul></div>; }

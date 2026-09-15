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
  generateHookMatrix,
  generateKerjakuAtmVersion,
  getIntelligenceWorkspace,
  reviewKerjakuAtmVersion,
  runViralDnaAnalysis,
  selectHookCandidate,
  type AtmMode,
  type AtmVersion,
  type DnaEvidence,
  type HookCandidate,
} from "@/lib/cliper-intelligence.functions";

export function CliperIntelligencePanel({ sourceId, gateAllowed }: { sourceId: string; gateAllowed: boolean }) {
  const queryClient = useQueryClient();
  const load = useServerFn(getIntelligenceWorkspace);
  const analyze = useServerFn(runViralDnaAnalysis);
  const generate = useServerFn(generateKerjakuAtmVersion);
  const review = useServerFn(reviewKerjakuAtmVersion);
  const buildHooks = useServerFn(generateHookMatrix);
  const chooseHook = useServerFn(selectHookCandidate);
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

  const hookMutation = useMutation({
    mutationFn: (versionId: string) => buildHooks({ data: { versionId } }),
    onSuccess: async () => { await refresh(); toast.success("5 kandidat hook siap dipilih."); },
    onError: (error: Error) => toast.error(error.message),
  });
  const selectMutation = useMutation({
    mutationFn: (input: { versionId: string; hookId: string }) => chooseHook({ data: input }),
    onSuccess: async () => { await refresh(); toast.success("Hook dipilih. Sumber siap masuk tahap prompt."); },
    onError: (error: Error) => toast.error(error.message),
  });

  const dna = query.data?.dna ?? null;
  const versions = query.data?.versions ?? [];

  return (
    <section className="space-y-5 border-t border-border pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><Brain className="size-5 text-primary" /> Analysis · Viral DNA</h2>
          <p className="mt-1 text-sm text-muted-foreground">Formula sumber, ATM KERJAKU, Hook Matrix, dan konsep pilihan tetap berada di workspace ini.</p>
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
            <DnaRow label="Kalimat/Visual Pembuka" value={dna.hook} />
            <DnaRow label="Alasan Viewer Tertarik" value={dna.hook_reason} />
            <DnaRow label="Kejutan di Awal Video" value={dna.pattern_interrupt} />
            <DnaRow label="Dorongan Emosi Viewer" value={dna.psychological_trigger} />
            <DnaRow label="Rasa Penasaran yang Dibuat" value={dna.curiosity_gap} />
            <DnaRow label="Alur Cerita Video" value={dna.structure_type} />
            <DnaRow label="Alasan Viewer Bertahan" value={dna.retention_factor} />
            <DnaRow label="Pemicu Interaksi" value={dna.engagement_factor} />
            <DnaRow label="Alasan Video Disimpan" value={dna.save_trigger} />
            <DnaRow label="Alasan Video Dibagikan" value={dna.share_trigger} />
            <DnaRow label="Alasan Viewer Berkomentar" value={dna.comment_trigger} />
            <div><p className="text-xs font-semibold uppercase text-muted-foreground">Kata Kuat yang Terdengar/Terlihat</p><div className="mt-2 flex flex-wrap gap-1">{dna.power_words.map((word) => <Badge key={word} variant="secondary">{word}</Badge>)}</div></div>

            <Evidence items={dna.evidence} />
          </div>

          <div className="surface-panel space-y-4 p-5">
            <div><h3 className="font-display font-semibold">ATM KERJAKU</h3><p className="mt-1 text-xs text-muted-foreground">Amati formula sumber, tiru prinsipnya, lalu modifikasi menjadi arah KERJAKU.</p></div>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={mode === "conservative" ? "default" : "outline"} onClick={() => setMode("conservative")}>Conservative</Button>
              <Button type="button" variant={mode === "creative" ? "default" : "outline"} onClick={() => setMode("creative")}>Creative</Button>
            </div>
            <p className="text-xs text-muted-foreground">{mode === "conservative" ? "Mempertahankan formula dan urutan persuasi utama, dengan konteks KERJAKU yang orisinal." : "Mengambil prinsip viral, lalu mengubah angle dan arah storytelling lebih jauh."}</p>
            <div className="space-y-2">
              <Label htmlFor="atm-angle">Tambahan arahan (opsional)</Label>
              <Textarea id="atm-angle" value={angle} onChange={(e) => setAngle(e.target.value)} placeholder="Contoh: fokuskan untuk konten edukasi UMKM, desain, atau AI" />
              <p className="text-xs text-muted-foreground">Kosongkan jika ingin AI menentukan arah berdasarkan Viral DNA.</p>
            </div>
            <Button className="w-full" onClick={() => atmMutation.mutate()} disabled={atmMutation.isPending}>{atmMutation.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}Buat Arah ATM</Button>
            <p className="text-[11px] text-muted-foreground">Comparison Matrix tersimpan pada formula dipertahankan, elemen diubah, dan originality safeguards.</p>
          </div>
        </div>
      ) : <div className="surface-panel p-6 text-sm text-muted-foreground">Belum ada Viral DNA. Jalankan analisis setelah Source Extraction lolos quality gate.</div>}

      {versions.length ? <div className="space-y-3"><h3 className="font-display text-sm font-semibold">Approval Checkpoint</h3>{versions.map((version) => <VersionReview key={version.id} version={version} note={notes[version.id] ?? ""} onNote={(value) => setNotes((current) => ({ ...current, [version.id]: value }))} onDecision={(decision) => reviewMutation.mutate({ version, decision })} busy={reviewMutation.isPending} onBuildHooks={() => hookMutation.mutate(version.id)} hooksBusy={hookMutation.isPending} onSelectHook={(hookId) => selectMutation.mutate({ versionId: version.id, hookId })} selectBusy={selectMutation.isPending} />)}</div> : null}
    </section>
  );
}

function DnaRow({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-semibold uppercase text-primary">{label}</p><p className="mt-1 text-sm text-muted-foreground">{value || "—"}</p></div>; }
function Evidence({ items }: { items: DnaEvidence[] }) { if (!items.length) return null; return <div><p className="text-xs font-semibold uppercase text-muted-foreground">Bukti sumber</p><ul className="mt-2 space-y-1.5">{items.map((item, index) => <li key={`${item.timestamp}-${index}`} className="text-xs text-muted-foreground"><span className="font-mono text-primary">{item.timestamp}</span> · {item.quote}</li>)}</ul></div>; }
function VersionReview({ version, note, onNote, onDecision, busy, onBuildHooks, hooksBusy, onSelectHook, selectBusy }: { version: AtmVersion; note: string; onNote: (value: string) => void; onDecision: (value: "approved" | "rejected") => void; busy: boolean; onBuildHooks: () => void; hooksBusy: boolean; onSelectHook: (hookId: string) => void; selectBusy: boolean }) {
  const adaptation = version.adaptation;
  const mapping = version.source_mapping;
  const candidates = version.hook_candidates ?? [];
  const selected = version.selected_hook;
  return <article className="surface-panel space-y-4 p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><Badge>{version.atm_mode === "conservative" ? "Conservative" : "Creative"}</Badge><Badge variant="outline">{version.status.replace("_", " ")}</Badge></div><span className="text-xs text-muted-foreground">Brand {version.brand_profile_version}</span></div><div><p className="text-xs font-semibold uppercase text-primary">Angle</p><p className="mt-1 text-sm">{version.angle}</p></div><div className="grid gap-3 md:grid-cols-2"><DnaRow label="Premis strategis" value={adaptation.strategic_premise ?? ""} /><DnaRow label="Relevansi audience" value={adaptation.target_audience_relevance ?? ""} /><DnaRow label="Arah storytelling" value={adaptation.storytelling_direction ?? ""} /><DnaRow label="Arah brand voice" value={adaptation.brand_voice_direction ?? ""} /><DnaRow label="Koneksi produk" value={adaptation.product_connection ?? ""} /><DnaRow label="Alasan" value={version.reason} /></div><div className="grid gap-3 md:grid-cols-2"><DnaRow label="Target audience" value={adaptation.target_audience ?? ""} /><DnaRow label="Format konten disarankan" value={adaptation.recommended_format ?? ""} /></div><div className="grid gap-3 md:grid-cols-2"><BulletList label="Formula sumber ditemukan" items={adaptation.source_formula ?? []} /><BulletList label="Formula dipertahankan" items={mapping.preserved_formula ?? []} /><BulletList label="Elemen diubah" items={mapping.changed_elements ?? []} /><BulletList label="Ide angle konten" items={adaptation.angle_ideas ?? []} /><BulletList label="Contoh hook baru" items={adaptation.example_hooks ?? []} /><BulletList label="Originality safeguards" items={adaptation.originality_safeguards ?? []} /></div>{version.status === "pending_approval" ? <div className="space-y-3 border-t border-border pt-4"><div className="space-y-2"><Label htmlFor={`note-${version.id}`}>Catatan persetujuan / revisi</Label><Textarea id={`note-${version.id}`} value={note} onChange={(e) => onNote(e.target.value)} placeholder="Tambahkan arahan untuk tahap berikutnya" /></div><div className="flex flex-wrap gap-2"><Button onClick={() => onDecision("approved")} disabled={busy}><BadgeCheck />Setujui Arah</Button><Button variant="destructive" onClick={() => onDecision("rejected")} disabled={busy || !note.trim()}><XCircle />Tolak & Minta Revisi</Button></div></div> : <div className={`flex items-center gap-2 text-sm ${version.status === "approved" ? "text-accent" : "text-destructive"}`}>{version.status === "approved" ? <BadgeCheck className="size-4" /> : <XCircle className="size-4" />}<span>{version.status === "approved" ? "Disetujui. Lanjut pilih hook sebelum produksi." : `Ditolak: ${version.approval_note}`}</span></div>}
    {version.status === "approved" ? (
      <div className="space-y-3 border-t border-border pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-display text-sm font-semibold">Hook Matrix</h4>
          <Button size="sm" variant="outline" onClick={onBuildHooks} disabled={hooksBusy}>
            {hooksBusy ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {candidates.length ? "Buat Ulang 5 Hook" : "Buat 5 Hook"}
          </Button>
        </div>
        {candidates.length ? (
          <ul className="space-y-2">
            {candidates.map((candidate) => {
              const isSelected = selected?.id === candidate.id;
              return (
                <li key={candidate.id} className={`rounded-xl border p-3 ${isSelected ? "border-accent/50 bg-accent/10" : "border-border bg-secondary/30"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{candidate.hook}</p>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-[10px]">{candidate.hook_type}</Badge>
                        {candidate.power_words.map((word) => <Badge key={word} variant="secondary" className="text-[10px]">{word}</Badge>)}
                      </div>
                    </div>
                    <Button size="sm" variant={isSelected ? "default" : "outline"} onClick={() => onSelectHook(candidate.id)} disabled={selectBusy || isSelected}>
                      {isSelected ? <BadgeCheck /> : null}{isSelected ? "Terpilih" : "Pilih Hook"}
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{candidate.rationale}</p>
                  <p className="mt-1 text-xs text-muted-foreground"><span className="text-primary">Trigger:</span> {candidate.psychological_trigger} · <span className="text-primary">Curiosity:</span> {candidate.curiosity_gap}</p>
                  {candidate.risk_note ? <p className="mt-1 text-[11px] text-amber-400">{candidate.risk_note}</p> : null}
                </li>
              );
            })}
          </ul>
        ) : <p className="text-xs text-muted-foreground">Belum ada kandidat hook. Buat 5 hook lalu pilih satu sebelum masuk tahap produksi.</p>}
        {selected ? (
          <div className="space-y-3 border-t border-border pt-4">
            <div className="flex items-center gap-2 text-sm text-accent"><BadgeCheck className="size-4" /> Selected Concept tersimpan</div>
            <div className="rounded-lg border border-accent/40 bg-accent/10 p-4">
              <p className="text-xs font-semibold uppercase text-accent">Selected Concept</p>
              <p className="mt-2 text-sm font-medium">{selected.hook}</p>
              <p className="mt-2 text-xs text-muted-foreground">{selected.rationale}</p>
            </div>
            <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
              Output Prompt · Prompt Carousel dan Prompt Reels belum aktif pada Step 1.
            </div>
          </div>
        ) : null}
      </div>
    ) : null}
  </article>;
}
function BulletList({ label, items }: { label: string; items: string[] }) { if (!items.length) return null; return <div><p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p><ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-muted-foreground">{items.map((item) => <li key={item}>{item}</li>)}</ul></div>; }

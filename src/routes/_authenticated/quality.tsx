import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  getQualityWorkspace,
  overrideApproval,
  runQualityGate,
  type ApprovalStatus,
} from "@/lib/quality.functions";

export const Route = createFileRoute("/_authenticated/quality")({
  validateSearch: (search: Record<string, unknown>) => ({
    versionId: typeof search["versionId"] === "string" ? search["versionId"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Quality Gate — KERJAKU Cliper Intelligence" },
      {
        name: "description",
        content:
          "Validasi struktur, aturan deterministik, dan penilaian AI sebelum konten KERJAKU disetujui untuk publikasi.",
      },
      { property: "og:title", content: "Quality Gate — KERJAKU Cliper Intelligence" },
      {
        property: "og:description",
        content: "Skor mutu konten, alasan kegagalan, rekomendasi perbaikan, dan persetujuan manusia.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: QualityPage,
});

const APPROVAL_OPTIONS: ApprovalStatus[] = ["draft", "revision_needed", "approved", "ready_publish", "published"];

function ScoreBar({ label, value }: { label: string; value: number }) {
  const tone = value >= 80 ? "bg-primary" : value >= 70 ? "bg-amber-400" : "bg-destructive";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${tone}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}

function QualityPage() {
  const { versionId } = Route.useSearch();
  const queryClient = useQueryClient();
  const load = useServerFn(getQualityWorkspace);
  const run = useServerFn(runQualityGate);
  const override = useServerFn(overrideApproval);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<ApprovalStatus>("approved");

  const query = useQuery({
    queryKey: ["quality", versionId],
    queryFn: () => load({ data: { versionId } }),
    enabled: Boolean(versionId),
  });

  const evaluate = useMutation({
    mutationFn: () => run({ data: { versionId } }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["quality", versionId] });
      toast.success(
        result.status === "ready_production"
          ? `Konten lolos quality gate${result.repaired ? " setelah satu kali perbaikan otomatis" : ""}.`
          : "Konten perlu revisi. Cek alasan dan rekomendasi di bawah.",
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveOverride = useMutation({
    mutationFn: () => override({ data: { versionId, status, note } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["quality", versionId] });
      setNote("");
      toast.success("Keputusan manusia tercatat.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const data = query.data;
  const quality = data?.quality ?? null;
  const judge = quality?.judge_result ?? null;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
              <Link to="/production" search={{ versionId }}>
                <ArrowLeft /> Kembali ke Content Production
              </Link>
            </Button>
            <h1 className="font-display text-2xl font-semibold">Quality Gate</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Tiga lapis pemeriksaan: kelengkapan struktur, aturan deterministik, lalu penilai AI yang berdiri
              sendiri. Keputusan akhir tetap milik Anda.
            </p>
          </div>
          <Button onClick={() => evaluate.mutate()} disabled={!versionId || evaluate.isPending}>
            {evaluate.isPending ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
            {quality ? "Evaluasi Ulang" : "Jalankan Quality Gate"}
          </Button>
        </div>

        {!versionId ? (
          <p className="text-sm text-muted-foreground">Pilih sebuah versi KERJAKU dari Content Production.</p>
        ) : query.isLoading ? (
          <p className="text-sm text-muted-foreground">Memuat…</p>
        ) : !data?.version ? (
          <p className="text-sm text-muted-foreground">Versi tidak ditemukan.</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-6">
              <section className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{data.version.atm_mode}</Badge>
                  {quality ? (
                    <Badge variant={quality.status === "ready_production" ? "default" : "destructive"}>
                      {quality.status === "ready_production" ? "Ready Production" : "Revision Needed"}
                    </Badge>
                  ) : null}
                  {quality?.repair_attempted ? <Badge variant="outline">Auto repair 1x</Badge> : null}
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{data.version.angle}</p>
                {!data.hasProduction ? (
                  <p className="mt-3 text-sm text-destructive">
                    Aset produksi belum ada. Buat dulu di Content Production.
                  </p>
                ) : null}
              </section>

              {quality ? (
                <section className="space-y-4 rounded-xl border border-border bg-card p-5">
                  <div className="flex items-baseline justify-between">
                    <h2 className="font-display text-lg font-semibold">Quality Score Report</h2>
                    <span className="text-2xl font-semibold">{quality.overall_score}</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ScoreBar label="Pattern Interrupt" value={quality.pattern_score} />
                    <ScoreBar label="Psychological Trigger" value={quality.trigger_score} />
                    <ScoreBar label="Curiosity Gap" value={quality.curiosity_score} />
                    <ScoreBar label="Power Word" value={quality.power_score} />
                    <ScoreBar label="CTA" value={quality.cta_score} />
                    <ScoreBar label="Source Fidelity" value={quality.source_fidelity_score} />
                    <ScoreBar label="Brand Safety" value={quality.brand_safety} />
                  </div>
                  {judge?.summary ? <p className="text-sm text-muted-foreground">{judge.summary}</p> : null}
                </section>
              ) : null}

              {quality && quality.hard_failures.length > 0 ? (
                <section className="rounded-xl border border-destructive/40 bg-destructive/5 p-5">
                  <h2 className="font-display text-lg font-semibold">Gagal Keras</h2>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                    {quality.hard_failures.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {quality && quality.failed_criteria.length > 0 ? (
                <section className="rounded-xl border border-border bg-card p-5">
                  <h2 className="font-display text-lg font-semibold">Kriteria Belum Lolos</h2>
                  <ul className="mt-2 space-y-2 text-sm">
                    {quality.failed_criteria.map((item, index) => (
                      <li key={`${item.category}-${index}`} className="rounded-lg border border-border p-3">
                        <p className="font-medium">
                          {item.category} — {item.score}
                        </p>
                        <p className="mt-1 text-muted-foreground">{item.reason}</p>
                        {item.improvement_suggestion ? (
                          <p className="mt-1 text-muted-foreground">Saran: {item.improvement_suggestion}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {quality && quality.rule_result.issues.length > 0 ? (
                <section className="rounded-xl border border-border bg-card p-5">
                  <h2 className="font-display text-lg font-semibold">Temuan Aturan</h2>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {quality.rule_result.issues.map((issue, index) => (
                      <li key={index}>
                        <span className="text-foreground">{issue.rule}</span>: {issue.detail}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {quality && quality.structural_result.issues.length > 0 ? (
                <section className="rounded-xl border border-border bg-card p-5">
                  <h2 className="font-display text-lg font-semibold">Field Belum Lengkap</h2>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {quality.structural_result.issues.map((issue, index) => (
                      <li key={index}>
                        <span className="text-foreground">{issue.field}</span> ({issue.location}): {issue.detail}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>

            <aside className="space-y-4 rounded-xl border border-border bg-card p-5">
              <h2 className="font-display text-lg font-semibold">Human Approval</h2>
              <p className="text-sm text-muted-foreground">
                Status saat ini:{" "}
                <span className="font-medium text-foreground">{data.library?.approval_status ?? "belum ada"}</span>
              </p>
              {data.library?.override_note ? (
                <p className="text-sm text-muted-foreground">Catatan terakhir: {data.library.override_note}</p>
              ) : null}
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground" htmlFor="approval-status">
                  Ubah status
                </label>
                <select
                  id="approval-status"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as ApprovalStatus)}
                >
                  {APPROVAL_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Catatan keputusan (wajib)"
                rows={4}
              />
              <Button
                className="w-full"
                onClick={() => saveOverride.mutate()}
                disabled={!data.library || !note.trim() || saveOverride.isPending}
              >
                {saveOverride.isPending ? <Loader2 className="animate-spin" /> : null}
                Simpan Keputusan
              </Button>
              {!data.library ? (
                <p className="text-xs text-muted-foreground">
                  Jalankan quality gate dulu agar konten masuk Content Library.
                </p>
              ) : null}
            </aside>
          </div>
        )}
      </div>
    </AppShell>
  );
}

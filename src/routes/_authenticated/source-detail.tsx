import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  BadgeCheck,
  Clock,
  Film,
  Loader2,
  ScanText,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { CliperWorkspaceSteps } from "@/components/CliperWorkspaceSteps";
import { CliperIntelligencePanel } from "@/components/CliperIntelligencePanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { evaluateExtractionGate } from "@/lib/extraction-gate";
import { extractAudioChunks, extractFrames, probeVideoAsset } from "@/lib/video-media";
import {
  ACQUISITION_FAILED_MESSAGE,
  acquireAnalysisVideo,
} from "@/lib/video-acquisition.functions";

import {
  getSourceDetail,
  markVideoUnavailable,
  runSourceExtraction,
  setSourceProcessing,
  STAGE_MESSAGE,
  type ExtractionStatus,
  type PipelineStage,
  type ReportEvidence,
  type ReportField,
  type ReportItem,
  type SourceReportData,
} from "@/lib/video-understanding.functions";

export const Route = createFileRoute("/_authenticated/source-detail")({
  validateSearch: (search: Record<string, unknown>) => ({
    id: typeof search["id"] === "string" ? search["id"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Source Understanding — KERJAKU Cliper Intelligence" },
      {
        name: "description",
        content:
          "Pahami video sumber: transkrip bertimestamp, snapshot, teks di layar, dan Source Content Report dengan bukti terverifikasi.",
      },
      { property: "og:title", content: "Source Understanding — KERJAKU Cliper Intelligence" },
      {
        property: "og:description",
        content: "Transkrip, snapshot, dan Source Content Report berbasis bukti dari video sumber.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SourceDetailPage,
});

type Evidence = ReportEvidence;
type SourceReport = SourceReportData;

const STATUS_LABEL: Record<ExtractionStatus, string> = {
  processing: "Processing",
  completed: "Completed",
  partial: "Partial",
  failed: "Failed",
  needs_review: "Needs Review",
};

function statusTone(status: ExtractionStatus) {
  if (status === "completed") return "border-accent/40 bg-accent/15 text-accent";
  if (status === "failed") return "border-destructive/40 bg-destructive/15 text-destructive";
  if (status === "needs_review") return "border-amber-500/40 bg-amber-500/15 text-amber-400";
  return "border-primary/40 bg-primary/15 text-primary";
}

const EVIDENCE_LABEL: Record<Evidence["source_type"], string> = {
  transcript: "Transkrip",
  on_screen_text: "Teks di layar",
  visual: "Visual",
};

function EvidenceList({ evidence }: { evidence: Evidence[] }) {
  if (!evidence?.length) {
    return <p className="text-[11px] text-muted-foreground">Tanpa bukti dari sumber.</p>;
  }
  return (
    <ul className="space-y-1">
      {evidence.map((ev, i) => {
        const isVisual = ev.source_type === "visual";
        const tone = ev.verified
          ? "border-accent/40 bg-accent/10 text-accent"
          : isVisual
            ? "border-sky-500/40 bg-sky-500/10 text-sky-300"
            : "border-amber-500/40 bg-amber-500/10 text-amber-400";
        const note = isVisual
          ? ev.verification_status === "visual_confirmed"
            ? "Terlihat pada frame (bukan bukti literal)"
            : "Frame tidak ditemukan"
          : ev.reason;
        return (
          <li key={i} className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <Badge variant="outline" className={tone}>
              {ev.verified ? (
                <BadgeCheck className="mr-1 size-3" />
              ) : (
                <ShieldAlert className="mr-1 size-3" />
              )}
              {EVIDENCE_LABEL[ev.source_type]} · {ev.timestamp}
            </Badge>
            <span className="text-muted-foreground">“{ev.quote}”</span>
            {!ev.verified && note ? <span className="text-muted-foreground">— {note}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}

function VerifiedBadge({
  verified,
  status,
}: {
  verified?: boolean | undefined;
  status?: "verified" | "unverified" | "not_observed" | undefined;
}) {
  if (status === "not_observed") {
    return (
      <Badge variant="outline" className="border-border bg-secondary/50 text-muted-foreground">
        Tidak Teramati
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className={
        verified
          ? "border-accent/40 bg-accent/10 text-accent"
          : "border-amber-500/40 bg-amber-500/10 text-amber-400"
      }
    >
      {verified ? "Verified" : "Needs Review"}
    </Badge>
  );
}


function FieldBlock({ label, field }: { label: string; field?: ReportField | undefined }) {
  if (!field) return null;
  return (
    <div className="space-y-1.5 rounded-xl border border-border bg-secondary/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <VerifiedBadge verified={field.verified} status={field.status} />
      </div>
      <p className="text-sm">{field.value}</p>
      <EvidenceList evidence={field.evidence ?? []} />
    </div>
  );
}

function ItemsBlock({ label, items }: { label: string; items?: ReportItem[] | undefined }) {
  if (!items?.length) return null;
  return (
    <div className="space-y-2 rounded-xl border border-border bg-secondary/30 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <ul className="space-y-2.5">
        {items.map((item, i) => (
          <li key={i} className="space-y-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm">{item.text ?? item.name}</p>
              <VerifiedBadge verified={item.verified} status={item.status} />
            </div>
            <EvidenceList evidence={item.evidence ?? []} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function SourceDetailPage() {
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchDetail = useServerFn(getSourceDetail);
  const runExtraction = useServerFn(runSourceExtraction);
  const markProcessing = useServerFn(setSourceProcessing);
  const markUnavailable = useServerFn(markVideoUnavailable);
  const acquireVideo = useServerFn(acquireAnalysisVideo);
  const sendHeartbeat = useServerFn(heartbeatExtraction);
  const resetExtraction = useServerFn(resetSourceExtraction);
  const removeSource = useServerFn(deleteViralSource);

  const detail = useQuery({
    queryKey: ["source-detail", id],
    queryFn: () => fetchDetail({ data: { sourceId: id } }),
    enabled: Boolean(id),
    refetchInterval: (query) =>
      query.state.data?.extraction?.verification_status === "processing" ? 15_000 : false,
  });

  const source = detail.data?.source ?? null;
  const extraction = detail.data?.extraction ?? null;
  const report = (extraction?.source_report ?? {}) as SourceReport;
  const gate = evaluateExtractionGate(extraction);
  const workspaceStep = source?.status === "ready_for_prompt_generation"
    ? "Selected Concept"
    : source?.status === "approved"
      ? "Hook Matrix"
      : source?.status === "analysis_complete"
        ? "ATM KERJAKU"
        : "Analysis";

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const stage = (extraction?.pipeline_stage ?? "") as PipelineStage | "";
  const isRunning = extraction?.verification_status === "processing";
  const stageFailed =
    stage === "ANALYSIS_FAILED" ||
    stage === "VIDEO_NOT_AVAILABLE" ||
    stage === "ANALYSIS_TIMEOUT" ||
    stage === "PROCESS_INTERRUPTED";
  const canRetry = Boolean(extraction) && !isRunning && stageFailed;
  const stageMessage =
    stage && stage !== "COMPLETED" && stage !== "READY_FOR_ANALYSIS" && (isRunning || stageFailed)
      ? STAGE_MESSAGE[stage]
      : null;


  useEffect(() => {
    let active = true;
    if (!source?.video_path) {
      setVideoUrl(null);
      return;
    }
    void supabase.storage
      .from("viral-sources")
      .createSignedUrl(source.video_path, 60 * 60)
      .then(({ data }) => {
        if (active) setVideoUrl(data?.signedUrl ?? null);
      });
    return () => {
      active = false;
    };
  }, [source?.video_path]);

  const snapshots = useMemo(() => extraction?.snapshot_data ?? [], [extraction]);
  const [snapshotUrls, setSnapshotUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    if (!snapshots.length) {
      setSnapshotUrls({});
      return;
    }
    void supabase.storage
      .from("viral-sources")
      .createSignedUrls(
        snapshots.map((s) => s.path),
        60 * 60,
      )
      .then(({ data }) => {
        if (!active || !data) return;
        const map: Record<string, string> = {};
        data.forEach((item, index) => {
          const path = snapshots[index]?.path;
          if (path && item.signedUrl) map[path] = item.signedUrl;
        });
        setSnapshotUrls(map);
      });
    return () => {
      active = false;
    };
  }, [snapshots]);

  const process = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Sesi berakhir, silakan masuk kembali.");

      setProgress(STAGE_MESSAGE.RESOLVING_VIDEO_ASSET);
      const asset = await acquireVideo({ data: { sourceId: id } });
      if (asset.status !== "ANALYSIS_VIDEO_ASSET_READY" || !asset.video_reference) {
        const message = asset.safe_error_message ?? ACQUISITION_FAILED_MESSAGE;
        await markUnavailable({
          data: {
            sourceId: id,
            videoMetadata: {
              video_reference: source?.source_url ?? "",
              resolved_at: new Date().toISOString(),
              is_playable: false,
            },
          },
        });
        throw new Error(message);
      }

      const videoPath = asset.video_reference;
      let playbackUrl = source?.video_path === videoPath ? videoUrl : null;
      if (!playbackUrl) {
        const { data: signed } = await supabase.storage
          .from("viral-sources")
          .createSignedUrl(videoPath, 60 * 60);
        playbackUrl = signed?.signedUrl ?? null;
      }
      if (!playbackUrl) throw new Error("URL video belum siap, coba sesaat lagi.");

      const probe = await probeVideoAsset(playbackUrl);
      const videoMetadata = {
        asset_type: asset.is_temporary ? ("DIRECT_VIDEO" as const) : ("UPLOAD" as const),
        video_reference: videoPath,
        resolved_at: new Date().toISOString(),
        ...probe,
      };
      if (!probe.is_playable) {
        await markUnavailable({ data: { sourceId: id, videoMetadata } });
        throw new Error(STAGE_MESSAGE.VIDEO_NOT_AVAILABLE);
      }

      await markProcessing({ data: { sourceId: id } });
      void queryClient.invalidateQueries({ queryKey: ["viral-sources"] });
      void queryClient.invalidateQueries({ queryKey: ["source-detail", id] });

      setProgress("Mengambil snapshot dari video…");
      const { frames } = await extractFrames(playbackUrl, (done, total) =>
        setProgress(`Mengambil snapshot ${done}/${total}…`),
      );

      if (!frames.length) throw new Error("Tidak ada frame yang bisa diambil dari video ini.");

      const prefix = `${uid}/extractions/${id}`;
      const uploadedSnapshots: Array<{ path: string; timestamp: string; reason: string }> = [];
      for (const [index, frame] of frames.entries()) {
        setProgress(`Mengunggah snapshot ${index + 1}/${frames.length}…`);
        const path = `${prefix}/frame-${String(index).padStart(2, "0")}.jpg`;
        const { error } = await supabase.storage
          .from("viral-sources")
          .upload(path, frame.blob, { upsert: true, contentType: "image/jpeg" });
        if (error) throw new Error(error.message);
        uploadedSnapshots.push({ path, timestamp: frame.timestamp, reason: frame.reason });
      }

      setProgress("Memisahkan audio untuk transkrip…");
      const chunks = await extractAudioChunks(playbackUrl).catch(() => []);
      const uploadedChunks: Array<{ path: string; timestamp: string }> = [];
      for (const [index, chunk] of chunks.entries()) {
        setProgress(`Mengunggah audio ${index + 1}/${chunks.length}…`);
        const path = `${prefix}/audio-${String(index).padStart(2, "0")}.wav`;
        const { error } = await supabase.storage
          .from("viral-sources")
          .upload(path, chunk.blob, { upsert: true, contentType: "audio/wav" });
        if (error) throw new Error(error.message);
        uploadedChunks.push({ path, timestamp: chunk.timestamp });
      }

      setProgress("AI sedang memahami video…");
      return runExtraction({
        data: {
          sourceId: id,
          audioChunks: uploadedChunks,
          snapshots: uploadedSnapshots,
          videoMetadata,
        },
      });
    },
    onSuccess: (result) => {
      setProgress(null);
      void queryClient.invalidateQueries({ queryKey: ["source-detail", id] });
      void queryClient.invalidateQueries({ queryKey: ["viral-sources"] });
      toast.success(
        `Pemahaman video selesai — ${STATUS_LABEL[result.status]} (keyakinan ${result.score}%).`,
      );
    },
    onError: (err: Error) => {
      setProgress(null);
      void queryClient.invalidateQueries({ queryKey: ["source-detail", id] });
      toast.error(err.message);
    },
  });

  // Detak proses tiap 30 detik selama analisis berjalan.
  useEffect(() => {
    if (!id || !(process.isPending || isRunning)) return;
    const timer = setInterval(() => {
      void sendHeartbeat({ data: { sourceId: id } });
    }, 30_000);
    return () => clearInterval(timer);
  }, [id, process.isPending, isRunning, sendHeartbeat]);

  const retry = useMutation({
    mutationFn: async () => {
      await archiveRetry({ data: { sourceId: id } });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["source-detail", id] });
      void queryClient.invalidateQueries({ queryKey: ["viral-sources"] });
      toast.success("Analisis berhasil direset");
      process.mutate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resetOnly = useMutation({
    mutationFn: async () => {
      await resetExtraction({ data: { sourceId: id } });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["source-detail", id] });
      void queryClient.invalidateQueries({ queryKey: ["viral-sources"] });
      toast.success("Analisis berhasil direset");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      await removeSource({ data: { id } });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["viral-sources"] });
      toast.success("Source berhasil dihapus");
      void navigate({ to: "/sources" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!id) {
    return (
      <AppShell>
        <div className="surface-panel p-8 text-center text-sm text-muted-foreground">
          Sumber tidak dipilih.{" "}
          <Link to="/sources" className="text-primary hover:underline">
            Kembali ke Source Intake
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <Link
              to="/sources"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3" /> Cliper
            </Link>
            <h1 className="font-display text-2xl font-bold tracking-tight"><span className="brand-text">Cliper</span> Intelligence</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {source?.title || "Tanpa judul"} — AI hanya mengekstrak isi video asli, tanpa membuat
              ide baru.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => process.mutate()}
              disabled={
                process.isPending || isRunning || !(source?.video_path || source?.source_url)
              }
            >
              {process.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {extraction ? "Proses Ulang Video" : "Proses Video"}
            </Button>

            {isRunning ? (
              <Button
                variant="outline"
                onClick={() => void detail.refetch()}
                disabled={detail.isFetching}
              >
                <RefreshCw className={`size-4 ${detail.isFetching ? "animate-spin" : ""}`} />
                Refresh Status
              </Button>
            ) : null}

            {canRetry ? (
              <Button variant="outline" onClick={() => retry.mutate()} disabled={retry.isPending}>
                {retry.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RotateCcw className="size-4" />
                )}
                Proses Ulang
              </Button>
            ) : null}

            {extraction ? (
              <Button
                variant="outline"
                onClick={() => resetOnly.mutate()}
                disabled={resetOnly.isPending || isRunning}
              >
                {resetOnly.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Eraser className="size-4" />
                )}
                Reset Analisis
              </Button>
            ) : null}

            <DeleteSourceDialog
              running={isRunning}
              disabled={remove.isPending}
              onConfirm={() => remove.mutate()}
              trigger={
                <Button variant="outline" className="text-destructive">
                  <Trash2 className="size-4" /> Hapus Source
                </Button>
              }
            />
          </div>
        </div>

        <CliperWorkspaceSteps current={workspaceStep} />

        {extraction || isRunning ? <ExtractionProgress stage={stage} running={isRunning} /> : null}

        {progress ? (
          <div className="surface-panel flex items-center gap-2 p-4 text-sm text-primary">
            <Loader2 className="size-4 animate-spin" /> {progress}
          </div>
        ) : stageMessage ? (
          <div
            className={`surface-panel flex items-center gap-2 p-4 text-sm ${
              stageFailed ? "text-destructive" : "text-primary"
            }`}
          >
            {stageFailed ? (
              <ShieldAlert className="size-4" />
            ) : (
              <Loader2 className="size-4 animate-spin" />
            )}
            {stageMessage}
          </div>
        ) : null}

        {extraction ? (
          <div
            className={`surface-panel flex flex-wrap items-center gap-2 p-4 text-sm ${
              gate.level === "ready"
                ? "text-accent"
                : gate.level === "blocked"
                  ? "text-destructive"
                  : "text-amber-400"
            }`}
          >
            {gate.allowed ? (
              <BadgeCheck className="size-4" />
            ) : (
              <ShieldAlert className="size-4" />
            )}
            <span className="font-medium">
              {gate.allowed ? "Siap untuk analisis lanjutan" : "Belum siap untuk analisis lanjutan"}
            </span>
            <span className="text-muted-foreground">{gate.reason}</span>
          </div>
        ) : null}


        {detail.isLoading ? (
          <div className="surface-panel flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Memuat sumber…
          </div>
        ) : !source ? (
          <div className="surface-panel p-8 text-center text-sm text-muted-foreground">
            Sumber tidak ditemukan.
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
            <section className="space-y-4">
              <div className="surface-panel space-y-3 p-4">
                <h2 className="font-display text-sm font-semibold">Source Video</h2>
                <div className="overflow-hidden rounded-xl bg-secondary/60">
                  {videoUrl ? (
                    <video src={videoUrl} controls className="max-h-80 w-full object-contain" />
                  ) : (
                    <div className="flex aspect-video items-center justify-center text-muted-foreground">
                      <Film className="size-6" />
                    </div>
                  )}
                </div>
                {!source.video_path ? (
                  <p className="text-xs text-muted-foreground">
                    Sumber ini hanya berisi tautan. Unggah video agar bisa diproses AI.
                  </p>
                ) : null}
              </div>

              <div className="surface-panel space-y-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display text-sm font-semibold">Analysis · Transcript</h2>
                  {extraction ? (
                    <Badge variant="outline" className={statusTone(extraction.verification_status)}>
                      {STATUS_LABEL[extraction.verification_status]}
                    </Badge>
                  ) : null}
                </div>
                {extraction?.transcript?.length ? (
                  <ul className="space-y-2">
                    {extraction.transcript.map((seg, i) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <span className="shrink-0 font-mono text-xs text-primary">
                          {seg.timestamp}
                        </span>
                        <span className="text-muted-foreground">{seg.text}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {extraction && !extraction.has_audio
                      ? "Video tanpa suara — pemahaman memakai snapshot, OCR, dan visual (low confidence)."
                      : "Belum ada transkrip. Jalankan Proses Video."}
                  </p>
                )}
              </div>

              {snapshots.length ? (
                <div className="surface-panel space-y-3 p-4">
                  <h2 className="font-display text-sm font-semibold">Analysis · Snapshot ({snapshots.length})</h2>
                  <div className="grid grid-cols-3 gap-2">
                    {snapshots.map((snap) => (
                      <figure key={snap.path} className="space-y-1">
                        <div className="overflow-hidden rounded-lg bg-secondary/60">
                          {snapshotUrls[snap.path] ? (
                            <img
                              src={snapshotUrls[snap.path]}
                              alt={`Snapshot ${snap.timestamp}`}
                              className="aspect-9/16 w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="aspect-9/16 w-full" />
                          )}
                        </div>
                        <figcaption className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock className="size-3" />
                          {snap.timestamp}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>

            <section className="space-y-4">
              <div className="surface-panel space-y-3 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-sm font-semibold">Analysis · Source Facts</h2>
                  {extraction ? (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={statusTone(extraction.verification_status)}>
                        {STATUS_LABEL[extraction.verification_status]}
                      </Badge>
                      <Badge variant="outline">Laporan {extraction.report_confidence || extraction.confidence_score}%</Badge>
                      <Badge variant="outline">Sumber {extraction.source_confidence}%</Badge>
                      <Badge variant="outline">Kelengkapan {extraction.completeness_score}%</Badge>
                      <Badge variant="outline">Cakupan {extraction.coverage_score}%</Badge>
                    </div>
                  ) : null}
                </div>

                {extraction?.error_message ? (
                  <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                    {extraction.error_message}
                  </p>
                ) : null}

                {!extraction || !Object.keys(report).length ? (
                  <p className="text-sm text-muted-foreground">
                    Belum ada laporan. Klik Proses Video untuk mengekstrak isi sumber.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <FieldBlock label="Summary" field={report.summary} />
                    <FieldBlock label="Topic" field={report.topic} />
                    <FieldBlock label="Category" field={report.category} />
                    <FieldBlock label="Problem" field={report.problem} />
                    <FieldBlock label="Solution" field={report.solution} />
                    <FieldBlock label="Benefit untuk penonton" field={report.benefit_viewer} />
                    <ItemsBlock label="Main information" items={report.main_information} />
                    <ItemsBlock label="Tools / produk" items={report.tools_products} />
                    <ItemsBlock label="Steps / framework" items={report.steps_framework} />
                  </div>
                )}
              </div>

              {extraction?.on_screen_text?.length ? (
                <div className="surface-panel space-y-2 p-5">
                  <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
                    <ScanText className="size-4" /> Analysis · OCR
                  </h2>
                  <ul className="space-y-1.5">
                    {extraction.on_screen_text.map((item, i) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <span className="shrink-0 font-mono text-xs text-primary">
                          {item.timestamp}
                        </span>
                        <span className="text-muted-foreground">{item.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {extraction?.visual_analysis?.length ? (
                <div className="surface-panel space-y-2 p-5">
                  <h2 className="font-display text-sm font-semibold">Analysis · Scene Understanding</h2>
                  <ul className="space-y-2.5">
                    {extraction.visual_analysis.map((scene, i) => (
                      <li key={i} className="space-y-1">
                        <p className="text-sm font-medium">
                          <span className="font-mono text-xs text-primary">{scene.timestamp}</span>{" "}
                          {scene.scene}
                        </p>
                        <p className="text-xs text-muted-foreground">{scene.description}</p>
                        {scene.objects?.length ? (
                          <div className="flex flex-wrap gap-1">
                            {scene.objects.map((obj, k) => (
                              <Badge key={k} variant="outline" className="text-[10px]">
                                {obj}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          </div>
        )}

        {source && extraction ? (
          <CliperIntelligencePanel sourceId={id} gateAllowed={gate.allowed} />
        ) : null}
      </div>
    </AppShell>
  );
}

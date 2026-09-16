import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import type { ViralSource } from "@/lib/viral-sources.functions";

export type ExtractionStatus =
  | "processing"
  | "completed"
  | "partial"
  | "failed"
  | "needs_review";

export type EvidenceKind = "text" | "visual";
export type EvidenceVerification =
  | "verified"
  | "rejected"
  | "visual_confirmed"
  | "unverifiable_by_text";
export type InformationStatus = "verified" | "unverified" | "not_observed";

export type ReportEvidence = {
  source_type: "transcript" | "on_screen_text" | "visual";
  timestamp: string;
  quote: string;
  verified: boolean;
  reason?: string | undefined;
  evidence_type?: EvidenceKind;
  verification_status?: EvidenceVerification;
};
export type ReportField = {
  value: string;
  evidence: ReportEvidence[];
  verified: boolean;
  status?: InformationStatus;
};
export type ReportItem = {
  text?: string;
  name?: string;
  evidence: ReportEvidence[];
  verified: boolean;
  status?: InformationStatus;
};
export type SourceReportData = Partial<{
  summary: ReportField;
  topic: ReportField;
  category: ReportField;
  problem: ReportField;
  solution: ReportField;
  benefit_viewer: ReportField;
  main_information: ReportItem[];
  tools_products: ReportItem[];
  steps_framework: ReportItem[];
}>;

/** Tahap pipeline yang tersimpan permanen agar progres tetap benar setelah refresh. */
export const PIPELINE_STAGES = [
  "READY_FOR_ANALYSIS",
  "RESOLVING_VIDEO_ASSET",
  "VIDEO_NOT_AVAILABLE",
  "EXTRACTING_METADATA",
  "EXTRACTING_FRAMES",
  "EXTRACTING_AUDIO",
  "TRANSCRIBING",
  "READING_SCREEN_TEXT",
  "ANALYZING_SCENES",
  "BUILDING_SOURCE_FACTS",
  "COMPLETED",
  "ANALYSIS_FAILED",
  "ANALYSIS_TIMEOUT",
  "PROCESS_INTERRUPTED",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

/** Tahap tidak berubah selama 5 menit → proses dianggap timeout. */
export const ANALYSIS_TIMEOUT_MS = 5 * 60 * 1000;
/** Batas waktu tanpa detak proses (browser ditutup) sebelum dianggap terputus. */
export const ANALYSIS_HEARTBEAT_STALE_MS = 90 * 1000;

/** Urutan progres yang ditampilkan ke pengguna. */
export const PROGRESS_STEPS = [
  { key: "VIDEO", label: "Video", stages: ["RESOLVING_VIDEO_ASSET", "EXTRACTING_METADATA"] },
  { key: "AUDIO", label: "Audio", stages: ["EXTRACTING_AUDIO"] },
  { key: "TRANSCRIPT", label: "Transcript", stages: ["TRANSCRIBING"] },
  { key: "OCR", label: "OCR", stages: ["READING_SCREEN_TEXT"] },
  { key: "SNAPSHOT", label: "Snapshot", stages: ["EXTRACTING_FRAMES"] },
  { key: "SCENE", label: "Scene", stages: ["ANALYZING_SCENES", "BUILDING_SOURCE_FACTS"] },
  { key: "DNA", label: "Viral DNA", stages: ["COMPLETED"] },
] as const;

export const STAGE_MESSAGE: Record<PipelineStage, string> = {
  READY_FOR_ANALYSIS: "Siap dianalisis.",
  RESOLVING_VIDEO_ASSET: "Membaca sumber video…",
  VIDEO_NOT_AVAILABLE:
    "File video asli belum tersedia sehingga analisis belum dapat dijalankan. Gunakan file upload atau selesaikan proses perolehan video terlebih dahulu.",
  EXTRACTING_METADATA: "Mengambil metadata…",
  EXTRACTING_FRAMES: "Mengambil frame asli…",
  EXTRACTING_AUDIO: "Mengekstrak audio…",
  TRANSCRIBING: "Membuat transkrip…",
  READING_SCREEN_TEXT: "Membaca teks pada layar…",
  ANALYZING_SCENES: "Menganalisis scene…",
  BUILDING_SOURCE_FACTS: "Menyusun Source Facts…",
  COMPLETED: "Analisis selesai.",
  ANALYSIS_FAILED: "Analisis gagal.",
  ANALYSIS_TIMEOUT:
    "Proses analisis berhenti karena melewati batas waktu. Silakan coba proses ulang atau hapus source dan upload kembali.",
  PROCESS_INTERRUPTED:
    "Proses analisis terputus sebelum selesai. Silakan proses ulang video atau hapus source ini.",
};


export type VideoAssetMetadata = Partial<{
  asset_type: "UPLOAD" | "EXISTING_ASSET" | "DIRECT_VIDEO";
  video_reference: string;
  duration: number;
  width: number;
  height: number;
  aspect_ratio: string;
  mime_type: string;
  file_size: number;
  is_playable: boolean;
  resolved_at: string;
}>;

export type SourceExtraction = {
  id: string;
  source_id: string;
  pipeline_stage: PipelineStage | "";
  failed_stage: string | null;
  video_metadata: VideoAssetMetadata;
  transcript: Array<{ timestamp: string; text: string }>;
  snapshot_data: Array<{ path: string; timestamp: string; reason: string }>;
  visual_analysis: Array<{
    timestamp: string;
    scene: string;
    description: string;
    objects: string[];
  }>;
  on_screen_text: Array<{ timestamp: string; text: string }>;
  source_report: SourceReportData;
  verification_status: ExtractionStatus;
  confidence_score: number;
  completeness_score: number;
  coverage_score: number;
  source_confidence: number;
  report_confidence: number;
  has_audio: boolean;
  model: string;
  error_message: string | null;
  last_heartbeat_at?: string;
  stage_changed_at?: string;
  created_at: string;
  updated_at: string;
};


export const getSourceDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sourceId: string }) => input)
  .handler(
    async ({
      data,
      context,
    }): Promise<{ source: ViralSource | null; extraction: SourceExtraction | null }> => {
      const [source, extraction] = await Promise.all([
        context.supabase.from("viral_sources").select("*").eq("id", data.sourceId).maybeSingle(),
        context.supabase
          .from("source_extractions")
          .select("*")
          .eq("source_id", data.sourceId)
          .maybeSingle(),
      ]);
      if (source.error) throw new Error(source.error.message);
      if (extraction.error) throw new Error(extraction.error.message);

      let row = (extraction.data ?? null) as SourceExtraction | null;

      // Auto-clean: kombinasi detak berhenti + tahap tidak berubah 5 menit.
      if (row && row.verification_status === "processing") {
        const now = Date.now();
        const stageAt = new Date(row.stage_changed_at ?? row.updated_at).getTime();
        const beatAt = new Date(row.last_heartbeat_at ?? row.updated_at).getTime();
        const stageIdle = now - stageAt;
        const beatIdle = now - beatAt;
        const stage: PipelineStage | null =
          beatIdle > ANALYSIS_HEARTBEAT_STALE_MS && stageIdle > ANALYSIS_TIMEOUT_MS
            ? "ANALYSIS_TIMEOUT"
            : beatIdle > ANALYSIS_HEARTBEAT_STALE_MS
              ? "PROCESS_INTERRUPTED"
              : null;
        if (stage) {
          const patch = {
            verification_status: "failed" as const,
            pipeline_stage: stage,
            failed_stage: row.pipeline_stage || null,
            error_message: STAGE_MESSAGE[stage],
          };
          await context.supabase
            .from("source_extractions")
            .update(patch)
            .eq("source_id", data.sourceId);
          await context.supabase
            .from("viral_sources")
            .update({ status: "failed" })
            .eq("id", data.sourceId);
          row = { ...row, ...patch } as SourceExtraction;
          if (source.data) source.data.status = "failed";
        }
      }

      return {
        source: (source.data ?? null) as ViralSource | null,
        extraction: row,
      };
    },
  );

/** Detak proses agar analisis yang masih berjalan tidak dianggap terputus. */
export const heartbeatExtraction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sourceId: string }) => input)
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("source_extractions")
      .update({ last_heartbeat_at: new Date().toISOString() })
      .eq("source_id", data.sourceId)
      .eq("verification_status", "processing");
    return { ok: true };
  });

/**
 * Arsipkan hasil analisis lama lalu bersihkan, video asli tetap dipertahankan.
 * reason "retry" = proses ulang, "reset" = reset analisis (hasil AI lanjutan ikut dibuang).
 */
async function archiveAndClear(
  context: { supabase: any; userId: string },
  sourceId: string,
  reason: "retry" | "reset",
) {
  const { data: row } = await context.supabase
    .from("source_extractions")
    .select("*")
    .eq("source_id", sourceId)
    .maybeSingle();

  if (row) {
    await context.supabase.from("source_extraction_archives").insert({
      user_id: context.userId,
      source_id: sourceId,
      archived_reason: reason,
      snapshot: row,
    });

    const paths = Array.isArray(row.snapshot_data)
      ? (row.snapshot_data as Array<{ path?: string }>)
          .map((s) => s?.path)
          .filter((p): p is string => typeof p === "string")
      : [];
    if (paths.length) {
      await context.supabase.storage.from("viral-sources").remove(paths);
    }
    await context.supabase.from("source_extractions").delete().eq("source_id", sourceId);
  }

  if (reason === "reset") {
    await context.supabase.from("viral_intelligence").delete().eq("source_id", sourceId);
  }

  await context.supabase.from("viral_sources").update({ status: "draft" }).eq("id", sourceId);
  return { ok: true, archived: Boolean(row) };
}

/** Proses ulang: hasil lama diarsipkan sebagai riwayat, bukan dihapus permanen. */
export const retrySourceExtraction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sourceId: string }) => input)
  .handler(async ({ data, context }) => archiveAndClear(context, data.sourceId, "retry"));

/** Reset analisis: hasil AI dibuang (diarsipkan), video asli tetap tersimpan. */
export const resetSourceExtraction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sourceId: string }) => input)
  .handler(async ({ data, context }) => archiveAndClear(context, data.sourceId, "reset"));


export const runSourceExtraction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      sourceId: string;
      audioChunks: Array<{ path: string; timestamp: string }>;
      snapshots: Array<{ path: string; timestamp: string; reason: string }>;
      videoMetadata?: VideoAssetMetadata;
    }) => input,
  )
  .handler(async ({ data, context }): Promise<{ status: ExtractionStatus; score: number }> => {
    const { EXTRACTION_MODEL, analyzeFrames, buildSourceReport, transcribeChunk, validateReport } =
      await import("@/lib/video-understanding.server");

    const { data: source, error: sourceError } = await context.supabase
      .from("viral_sources")
      .select("id")
      .eq("id", data.sourceId)
      .maybeSingle();
    if (sourceError) throw new Error(sourceError.message);
    if (!source) throw new Error("Sumber tidak ditemukan.");

    if (!data.snapshots.length) throw new Error("Snapshot video belum tersedia.");

    const base = {
      source_id: data.sourceId,
      user_id: context.userId,
      snapshot_data: data.snapshots,
      model: EXTRACTION_MODEL,
    };

    await context.supabase
      .from("source_extractions")
      .upsert(
        {
          ...base,
          verification_status: "processing" as const,
          transcript: [],
          visual_analysis: [],
          on_screen_text: [],
          source_report: {},
          confidence_score: 0,
          error_message: null,
          pipeline_stage: "TRANSCRIBING",
          failed_stage: null,
          video_metadata: (data.videoMetadata ?? {}) as unknown as Json,
        },
        { onConflict: "source_id" },
      )
      .throwOnError();

    const stage = async (value: PipelineStage) => {
      await context.supabase
        .from("source_extractions")
        .update({ pipeline_stage: value })
        .eq("source_id", data.sourceId);
    };

    let currentStage: PipelineStage = "TRANSCRIBING";
    const fail = async (message: string) => {
      await context.supabase
        .from("source_extractions")
        .update({
          verification_status: "failed",
          error_message: message,
          pipeline_stage: "ANALYSIS_FAILED",
          failed_stage: currentStage,
        })
        .eq("source_id", data.sourceId);
    };

    try {
      // A. Speech to text per potongan audio (timestamp = awal potongan).
      currentStage = "TRANSCRIBING";
      const transcript: Array<{ timestamp: string; text: string }> = [];
      for (const chunk of data.audioChunks) {
        const file = await context.supabase.storage.from("viral-sources").download(chunk.path);
        if (file.error || !file.data) continue;
        const bytes = new Uint8Array(await file.data.arrayBuffer());
        const text = await transcribeChunk(bytes, "chunk.wav");
        if (text) transcript.push({ timestamp: chunk.timestamp, text });
      }
      const hasAudio = transcript.length > 0;

      // C + D. Visual understanding & OCR dari snapshot.
      currentStage = "READING_SCREEN_TEXT";
      await stage(currentStage);
      const frames: Array<{ timestamp: string; dataUrl: string }> = [];
      for (const snap of data.snapshots) {
        const file = await context.supabase.storage.from("viral-sources").download(snap.path);
        if (file.error || !file.data) continue;
        const bytes = new Uint8Array(await file.data.arrayBuffer());
        let binary = "";
        for (let i = 0; i < bytes.length; i += 8192) {
          binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        }
        frames.push({
          timestamp: snap.timestamp,
          dataUrl: `data:image/jpeg;base64,${btoa(binary)}`,
        });
      }
      if (!frames.length) throw new Error("Snapshot tidak dapat dibaca dari penyimpanan.");

      currentStage = "ANALYZING_SCENES";
      await stage(currentStage);
      const visual = await analyzeFrames(frames);

      // PART 2. Source Content Report.
      currentStage = "BUILDING_SOURCE_FACTS";
      await stage(currentStage);
      const report = await buildSourceReport({
        transcript,
        onScreenText: visual.on_screen_text,
        scenes: visual.scenes,
      });

      // PART 4. Source lock validation (deterministik).
      const validation = validateReport(report, {
        transcript,
        onScreenText: visual.on_screen_text,
        scenes: visual.scenes,
        snapshots: data.snapshots,
      });

      // Video tanpa suara tetap diproses, tapi ditandai low confidence (visual-only).
      const score = hasAudio
        ? validation.confidence_score
        : Math.min(validation.confidence_score, 49);
      const status: ExtractionStatus =
        validation.verification_status === "failed"
          ? "failed"
          : hasAudio
            ? validation.verification_status
            : score < 50
              ? "needs_review"
              : "partial";

      await context.supabase
        .from("source_extractions")
        .update({
          transcript,
          visual_analysis: visual.scenes,
          on_screen_text: visual.on_screen_text,
          source_report: validation.report as unknown as Json,
          verification_status: status,
          confidence_score: score,
          report_confidence: validation.scores.report_confidence,
          source_confidence: validation.scores.source_confidence,
          coverage_score: validation.scores.coverage_score,
          completeness_score: validation.scores.completeness_score,
          has_audio: hasAudio,
          error_message: null,
          pipeline_stage: "COMPLETED",
          failed_stage: null,
        })
        .eq("source_id", data.sourceId)
        .throwOnError();


      await context.supabase
        .from("viral_sources")
        .update({ status: "source_extracted" })
        .eq("id", data.sourceId);

      return { status, score };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Pemrosesan video gagal.";
      await fail(message);
      await context.supabase
        .from("viral_sources")
        .update({ status: "failed" })
        .eq("id", data.sourceId);
      throw new Error(message);
    }
  });

export const setSourceProcessing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sourceId: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("viral_sources")
      .update({ status: "understanding" })
      .eq("id", data.sourceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Simpan status VIDEO_NOT_AVAILABLE saat file video asli tidak bisa diputar. */
export const markVideoUnavailable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { sourceId: string; videoMetadata?: VideoAssetMetadata; reason?: string }) => input,
  )
  .handler(async ({ data, context }) => {
    const { EXTRACTION_MODEL } = await import("@/lib/video-understanding.server");
    await context.supabase
      .from("source_extractions")
      .upsert(
        {
          source_id: data.sourceId,
          user_id: context.userId,
          model: EXTRACTION_MODEL,
          verification_status: "failed" as const,
          pipeline_stage: "VIDEO_NOT_AVAILABLE",
          failed_stage: "RESOLVING_VIDEO_ASSET",
          error_message: data.reason?.trim() || STAGE_MESSAGE.VIDEO_NOT_AVAILABLE,

          video_metadata: (data.videoMetadata ?? {}) as unknown as Json,
        },
        { onConflict: "source_id" },
      )
      .throwOnError();
    await context.supabase
      .from("viral_sources")
      .update({ status: "failed" })
      .eq("id", data.sourceId);
    return { ok: true };
  });

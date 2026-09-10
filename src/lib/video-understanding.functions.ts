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

export type ReportEvidence = {
  source_type: "transcript" | "on_screen_text" | "visual";
  timestamp: string;
  quote: string;
  verified: boolean;
};
export type ReportField = { value: string; evidence: ReportEvidence[]; verified: boolean };
export type ReportItem = {
  text?: string;
  name?: string;
  evidence: ReportEvidence[];
  verified: boolean;
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

export type SourceExtraction = {
  id: string;
  source_id: string;
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
  has_audio: boolean;
  model: string;
  error_message: string | null;
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
      return {
        source: (source.data ?? null) as ViralSource | null,
        extraction: (extraction.data ?? null) as SourceExtraction | null,
      };
    },
  );

export const runSourceExtraction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      sourceId: string;
      audioChunks: Array<{ path: string; timestamp: string }>;
      snapshots: Array<{ path: string; timestamp: string; reason: string }>;
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
        },
        { onConflict: "source_id" },
      )
      .throwOnError();

    const fail = async (message: string) => {
      await context.supabase
        .from("source_extractions")
        .update({ verification_status: "failed", error_message: message })
        .eq("source_id", data.sourceId);
    };

    try {
      // A. Speech to text per potongan audio (timestamp = awal potongan).
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

      const visual = await analyzeFrames(frames);

      // PART 2. Source Content Report.
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
      });

      // Video tanpa suara tetap diproses, tapi ditandai low confidence.
      const score = hasAudio
        ? validation.confidence_score
        : Math.min(validation.confidence_score, 49);
      const status: ExtractionStatus = hasAudio
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
          has_audio: hasAudio,
          error_message: null,
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

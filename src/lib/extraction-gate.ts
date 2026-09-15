import type { ExtractionStatus } from "@/lib/video-understanding.functions";

/** Satu standar ambang untuk validator dan gerbang mutu. */
export const READY_CONFIDENCE = 70;
export const PARTIAL_CONFIDENCE = 50;
/** Kelengkapan minimum agar laporan layak jadi input Viral DNA / ATM. */
export const MIN_COMPLETENESS = 60;
/** Alias lama (dipakai kode/uji sebelumnya). */
export const MIN_PARTIAL_CONFIDENCE = READY_CONFIDENCE;

export type ExtractionGate = {
  allowed: boolean;
  level: "ready" | "warning" | "blocked";
  reason: string;
};

/** Jumlah frame minimum agar analisis visual dianggap cukup. */
export const MIN_SNAPSHOTS = 3;
/** Panjang transkrip minimum (karakter) agar dianggap tersedia. */
export const MIN_TRANSCRIPT_CHARS = 50;

type GateInput = {
  verification_status: ExtractionStatus;
  confidence_score: number;
  report_confidence?: number | null;
  completeness_score?: number | null;
  transcript?: Array<{ text?: string | null }> | null;
  snapshot_data?: unknown[] | null;
  on_screen_text?: Array<{ text?: string | null }> | null;
  source_report?:
    | {
        topic?: { value?: string | null } | null;
        main_information?: unknown[] | null;
        steps_framework?: unknown[] | null;
      }
    | null;
};

/**
 * Kesiapan berbasis isi: transkrip (atau teks layar) memadai, frame cukup,
 * dan Source Facts punya topik serta poin utama.
 */
function contentReady(extraction: GateInput): boolean {
  const transcriptChars = (extraction.transcript ?? [])
    .map((chunk) => (chunk?.text ?? "").trim())
    .join(" ").length;
  const screenChars = (extraction.on_screen_text ?? [])
    .map((chunk) => (chunk?.text ?? "").trim())
    .join(" ").length;
  const snapshots = (extraction.snapshot_data ?? []).length;
  const report = extraction.source_report ?? {};
  const topic = (report.topic?.value ?? "").trim();
  const keyPoints =
    (report.main_information ?? []).length + (report.steps_framework ?? []).length;

  return (
    Math.max(transcriptChars, screenChars) > MIN_TRANSCRIPT_CHARS &&
    snapshots >= MIN_SNAPSHOTS &&
    topic.length > 0 &&
    keyPoints > 0
  );
}

/**
 * Gerbang mutu ekstraksi: hasil hanya boleh menjadi input analisis lanjutan
 * (Viral DNA / ATM) bila keyakinan laporan >= 70 dan kelengkapan memadai.
 */
export function evaluateExtractionGate(
  extraction: GateInput | null | undefined,
): ExtractionGate {
  if (!extraction) {
    return {
      allowed: false,
      level: "blocked",
      reason: "Video sumber belum diproses. Jalankan Proses Video terlebih dahulu.",
    };
  }

  const status = extraction.verification_status;
  const score = extraction.report_confidence ?? extraction.confidence_score;
  const completeness = extraction.completeness_score ?? 100;

  if (status === "processing") {
    return { allowed: false, level: "warning", reason: "Pemrosesan video masih berjalan." };
  }
  if (status === "failed") {
    return {
      allowed: false,
      level: "blocked",
      reason: "Mayoritas bukti gagal diverifikasi. Proses ulang video sebelum lanjut ke analisis.",
    };
  }
  if (status === "needs_review" || score < PARTIAL_CONFIDENCE) {
    return {
      allowed: false,
      level: "warning",
      reason: `Keyakinan laporan ${score}% di bawah ${PARTIAL_CONFIDENCE}%. Tinjau bukti yang ditolak atau proses ulang video.`,
    };
  }
  if (score < READY_CONFIDENCE) {
    return {
      allowed: false,
      level: "warning",
      reason: `Keyakinan laporan ${score}% di bawah minimum ${READY_CONFIDENCE}%. Tinjau bukti yang ditolak atau proses ulang video.`,
    };
  }
  if (completeness < MIN_COMPLETENESS) {
    return {
      allowed: false,
      level: "warning",
      reason: `Kelengkapan informasi baru ${completeness}%. Terlalu banyak bagian laporan tidak teramati pada sumber.`,
    };
  }

  return {
    allowed: true,
    level: "ready",
    reason:
      status === "completed"
        ? `Semua bukti utama terverifikasi (keyakinan ${score}%, kelengkapan ${completeness}%). Siap untuk analisis lanjutan.`
        : `Keyakinan laporan ${score}% dan kelengkapan ${completeness}%. Siap untuk analisis lanjutan.`,
  };
}


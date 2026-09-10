import type { ExtractionStatus } from "@/lib/video-understanding.functions";

/** Ambang minimal keyakinan agar hasil "partial" boleh dipakai tahap berikutnya. */
export const MIN_PARTIAL_CONFIDENCE = 70;

export type ExtractionGate = {
  allowed: boolean;
  level: "ready" | "warning" | "blocked";
  reason: string;
};

/**
 * Gerbang mutu ekstraksi: hasil hanya boleh menjadi input analisis lanjutan
 * (Viral DNA) bila statusnya completed, atau partial dengan keyakinan minimal.
 */
export function evaluateExtractionGate(
  extraction:
    | { verification_status: ExtractionStatus; confidence_score: number }
    | null
    | undefined,
): ExtractionGate {
  if (!extraction) {
    return {
      allowed: false,
      level: "blocked",
      reason: "Video sumber belum diproses. Jalankan Proses Video terlebih dahulu.",
    };
  }

  const status = extraction.verification_status;
  const score = extraction.confidence_score;

  if (status === "processing") {
    return { allowed: false, level: "warning", reason: "Pemrosesan video masih berjalan." };
  }
  if (status === "failed") {
    return {
      allowed: false,
      level: "blocked",
      reason: "Ekstraksi gagal. Proses ulang video sebelum lanjut ke analisis.",
    };
  }
  if (status === "needs_review") {
    return {
      allowed: false,
      level: "warning",
      reason: `Terlalu banyak bukti yang tidak terverifikasi (keyakinan ${score}%). Tinjau bukti atau proses ulang video.`,
    };
  }
  if (status === "partial" && score < MIN_PARTIAL_CONFIDENCE) {
    return {
      allowed: false,
      level: "warning",
      reason: `Keyakinan ${score}% di bawah minimum ${MIN_PARTIAL_CONFIDENCE}%. Tinjau bukti yang ditolak atau proses ulang video.`,
    };
  }

  return {
    allowed: true,
    level: "ready",
    reason:
      status === "completed"
        ? "Semua bukti terverifikasi. Siap untuk analisis lanjutan."
        : `Sebagian bukti terverifikasi (keyakinan ${score}%). Siap untuk analisis lanjutan.`,
  };
}

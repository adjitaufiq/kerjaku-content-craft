import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Pesan aman untuk pengguna saat video tidak bisa diperoleh dari sumbernya. */
export const ACQUISITION_FAILED_MESSAGE =
  "Video tidak dapat diperoleh dari sumber ini. Gunakan URL publik yang valid atau unggah file video secara manual.";

export type AcquiredAsset = {
  status: "ANALYSIS_VIDEO_ASSET_READY" | "VIDEO_ACQUISITION_FAILED";
  asset_type: "EXISTING_UPLOAD" | "TEMPORARY_DOWNLOAD" | "";
  video_reference: string;
  mime_type: string;
  file_size: number;
  checksum: string;
  is_temporary: boolean;
  reused: boolean;
  expires_at: string | null;
  error_code?: string;
  safe_error_message?: string;
};

function expired(at: string | null | undefined) {
  return Boolean(at) && new Date(at as string).getTime() <= Date.now();
}

/**
 * Menormalkan sumber (upload manual atau URL publik) menjadi satu
 * analysis_video_asset yang benar-benar playable sebelum analisis berjalan.
 * Aset yang masih berlaku dipakai ulang; aset kedaluwarsa dibersihkan.
 */
export const acquireAnalysisVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sourceId: string }) => input)
  .handler(async ({ data, context }): Promise<AcquiredAsset> => {
    const { data: source, error } = await context.supabase
      .from("viral_sources")
      .select("id, source_url, video_path, expires_at")
      .eq("id", data.sourceId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!source) throw new Error("Sumber tidak ditemukan.");

    let videoPath = source.video_path;

    // Bersihkan aset kedaluwarsa; hasil analisis yang sudah tersimpan tidak disentuh.
    if (videoPath && expired(source.expires_at)) {
      await context.supabase.storage.from("viral-sources").remove([videoPath]);
      await context.supabase
        .from("viral_sources")
        .update({ video_path: null })
        .eq("id", source.id);
      videoPath = null;
    }

    if (videoPath) {
      return {
        status: "ANALYSIS_VIDEO_ASSET_READY",
        asset_type: "EXISTING_UPLOAD",
        video_reference: videoPath,
        mime_type: "",
        file_size: 0,
        checksum: "",
        is_temporary: false,
        reused: true,
        expires_at: source.expires_at,
      };
    }

    if (!source.source_url) {
      return {
        status: "VIDEO_ACQUISITION_FAILED",
        asset_type: "",
        video_reference: "",
        mime_type: "",
        file_size: 0,
        checksum: "",
        is_temporary: false,
        reused: false,
        expires_at: null,
        error_code: "NO_SOURCE_URL",
        safe_error_message: ACQUISITION_FAILED_MESSAGE,
      };
    }

    const { downloadForAnalysis } = await import("@/lib/video-acquisition.server");
    const asset = await downloadForAnalysis(
      context.supabase.storage as unknown as Parameters<typeof downloadForAnalysis>[0],
      { sourceId: source.id, userId: context.userId, sourceUrl: source.source_url },
    );

    if (asset.status !== "ANALYSIS_VIDEO_ASSET_READY") {
      return {
        status: "VIDEO_ACQUISITION_FAILED",
        asset_type: "",
        video_reference: "",
        mime_type: "",
        file_size: 0,
        checksum: "",
        is_temporary: false,
        reused: false,
        expires_at: null,
        error_code: asset.error_code ?? "ACQUISITION_FAILED",
        safe_error_message: asset.safe_error_message ?? ACQUISITION_FAILED_MESSAGE,
      };
    }

    await context.supabase
      .from("viral_sources")
      .update({ video_path: asset.video_reference, expires_at: asset.expires_at })
      .eq("id", source.id);

    return {
      status: "ANALYSIS_VIDEO_ASSET_READY",
      asset_type: "TEMPORARY_DOWNLOAD",
      video_reference: asset.video_reference,
      mime_type: asset.mime_type,
      file_size: asset.file_size,
      checksum: asset.checksum,
      is_temporary: true,
      reused: false,
      expires_at: asset.expires_at,
    };
  });

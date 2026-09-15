/**
 * Video Source Resolver + Temporary Video Download.
 * Server-only. Menormalkan semua jenis sumber menjadi satu analysis_video_asset.
 * Tidak ada bypass login, tidak menembus proteksi platform: hanya file yang
 * memang disajikan publik (atau file unggahan pengguna) yang dipakai.
 */

export type AssetType =
  | "EXISTING_UPLOAD"
  | "EXISTING_VIDEO_ASSET"
  | "DIRECT_VIDEO"
  | "TEMPORARY_DOWNLOAD";

export type AcquisitionStatus =
  | "RESOLVING_SOURCE"
  | "DOWNLOADING_FOR_ANALYSIS"
  | "VALIDATING_VIDEO"
  | "ANALYSIS_VIDEO_ASSET_READY"
  | "VIDEO_ACQUISITION_FAILED";

export type AnalysisVideoAsset = {
  source_id: string;
  source_type: "UPLOAD" | "URL";
  asset_type: AssetType | "";
  video_reference: string;
  mime_type: string;
  duration: number;
  file_size: number;
  checksum: string;
  is_playable: boolean;
  is_temporary: boolean;
  downloaded_now: boolean;
  created_at: string;
  expires_at: string | null;
  status: AcquisitionStatus;
  failed_method?: string;
  error_code?: string;
  safe_error_message?: string;
  attempted_at?: string;
  retry_allowed?: boolean;
};

export const ACQUISITION_FAILED_MESSAGE =
  "Video tidak dapat diperoleh dari sumber ini. Gunakan URL publik yang valid atau unggah file video secara manual.";

/** Retention temporary video mengikuti retensi source existing: 3 hari. */
export const TEMP_RETENTION_DAYS = 3;
const MAX_BYTES = 200 * 1024 * 1024;

export const TEMPORARY_RETENTION_POLICY = "ANALYSIS_TEMPORARY";

function nowIso() {
  return new Date().toISOString();
}

export function failedAsset(
  sourceId: string,
  sourceType: "UPLOAD" | "URL",
  method: string,
  code: string,
): AnalysisVideoAsset {
  return {
    source_id: sourceId,
    source_type: sourceType,
    asset_type: "",
    video_reference: "",
    mime_type: "",
    duration: 0,
    file_size: 0,
    checksum: "",
    is_playable: false,
    is_temporary: false,
    downloaded_now: false,
    created_at: nowIso(),
    expires_at: null,
    status: "VIDEO_ACQUISITION_FAILED",
    failed_method: method,
    error_code: code,
    safe_error_message: ACQUISITION_FAILED_MESSAGE,
    attempted_at: nowIso(),
    retry_allowed: true,
  };
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function isVideoMime(mime: string) {
  return mime.startsWith("video/") || mime === "application/octet-stream";
}

/** Cek apakah URL menunjuk langsung ke berkas video yang dapat dibaca. */
export async function probeDirectVideo(
  url: string,
): Promise<{ ok: boolean; mime: string; size: number }> {
  try {
    const head = await fetch(url, { method: "HEAD", redirect: "follow" });
    const mime = (head.headers.get("content-type") ?? "").split(";")[0]?.trim() ?? "";
    const size = Number(head.headers.get("content-length") ?? 0) || 0;
    if (head.ok && mime.startsWith("video/")) return { ok: true, mime, size };
    if (head.ok && isVideoMime(mime) && /\.(mp4|mov|m4v|webm)(\?|$)/i.test(url)) {
      return { ok: true, mime: mime || "video/mp4", size };
    }
    return { ok: false, mime, size };
  } catch {
    return { ok: false, mime: "", size: 0 };
  }
}

/** Ambil URL video publik dari halaman platform (hanya metadata Open Graph publik). */
async function publicVideoUrlFromPage(pageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(pageUrl, {
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; KerjakuPublisher/1.0; +https://kerjaku-content-craft.lovable.app)",
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const patterns = [
      /<meta[^>]+property=["']og:video:secure_url["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+property=["']og:video["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:video["']/i,
    ];
    for (const re of patterns) {
      const match = html.match(re);
      if (match?.[1]) return match[1].replace(/&amp;/g, "&");
    }
    return null;
  } catch {
    return null;
  }
}

type StorageLike = {
  from: (bucket: string) => {
    upload: (
      path: string,
      body: Uint8Array,
      options: { contentType: string; upsert: boolean },
    ) => Promise<{ error: { message: string } | null }>;
    remove: (paths: string[]) => Promise<unknown>;
  };
};

/**
 * Temporary Video Download — hanya untuk kebutuhan analisis (frame, audio,
 * transcript, OCR, scene, Source Facts). Bukan media publikasi.
 */
export async function downloadForAnalysis(
  storage: StorageLike,
  opts: { sourceId: string; userId: string; sourceUrl: string },
): Promise<AnalysisVideoAsset> {
  const direct = await probeDirectVideo(opts.sourceUrl);
  const fileUrl = direct.ok ? opts.sourceUrl : await publicVideoUrlFromPage(opts.sourceUrl);
  if (!fileUrl) {
    return failedAsset(opts.sourceId, "URL", "TEMPORARY_DOWNLOAD", "NO_PUBLIC_VIDEO_FILE");
  }

  let bytes: Uint8Array;
  let mime = "video/mp4";
  try {
    const res = await fetch(fileUrl, { redirect: "follow" });
    if (!res.ok) {
      return failedAsset(opts.sourceId, "URL", "TEMPORARY_DOWNLOAD", `HTTP_${res.status}`);
    }
    const headerMime = (res.headers.get("content-type") ?? "").split(";")[0]?.trim() ?? "";
    if (headerMime && !isVideoMime(headerMime)) {
      return failedAsset(opts.sourceId, "URL", "TEMPORARY_DOWNLOAD", "NOT_A_VIDEO_FILE");
    }
    if (headerMime.startsWith("video/")) mime = headerMime;
    bytes = new Uint8Array(await res.arrayBuffer());
  } catch {
    return failedAsset(opts.sourceId, "URL", "TEMPORARY_DOWNLOAD", "DOWNLOAD_ERROR");
  }

  if (!bytes.byteLength || bytes.byteLength > MAX_BYTES) {
    return failedAsset(opts.sourceId, "URL", "TEMPORARY_DOWNLOAD", "INVALID_FILE_SIZE");
  }
  // Validasi isi berkas: container MP4/MOV (ftyp) atau WebM/Matroska.
  const header = Array.from(bytes.subarray(0, 12));
  const isMp4 = header[4] === 0x66 && header[5] === 0x74 && header[6] === 0x79 && header[7] === 0x70;
  const isWebm =
    header[0] === 0x1a && header[1] === 0x45 && header[2] === 0xdf && header[3] === 0xa3;
  if (!isMp4 && !isWebm) {
    return failedAsset(opts.sourceId, "URL", "TEMPORARY_DOWNLOAD", "NOT_A_VIDEO_FILE");
  }

  const path = `${opts.userId}/temp-analysis/${opts.sourceId}.${isWebm ? "webm" : "mp4"}`;
  const { error } = await storage
    .from("viral-sources")
    .upload(path, bytes, { contentType: mime, upsert: true });
  if (error) {
    return failedAsset(opts.sourceId, "URL", "TEMPORARY_DOWNLOAD", "STORAGE_WRITE_FAILED");
  }

  const created = new Date();
  return {
    source_id: opts.sourceId,
    source_type: "URL",
    asset_type: "TEMPORARY_DOWNLOAD",
    video_reference: path,
    mime_type: mime,
    duration: 0,
    file_size: bytes.byteLength,
    checksum: await sha256(bytes),
    is_playable: true,
    is_temporary: true,
    downloaded_now: true,
    created_at: created.toISOString(),
    expires_at: new Date(
      created.getTime() + TEMP_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString(),
    status: "ANALYSIS_VIDEO_ASSET_READY",
  };
}

/** Hapus temporary video (retensi habis atau sumber dihapus). Snapshot/transkrip tetap. */
export async function removeTemporaryAsset(storage: StorageLike, path: string) {
  await storage.from("viral-sources").remove([path]);
}

export function isExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= Date.now();
}

/** Browser-only helpers: snapshot extraction + audio chunking (WAV) dari video source. */

export type FrameCapture = { timestamp: string; seconds: number; reason: string; blob: Blob };
export type AudioChunk = { timestamp: string; seconds: number; blob: Blob };

export type VideoAssetProbe = {
  duration: number;
  width: number;
  height: number;
  aspect_ratio: string;
  mime_type: string;
  file_size: number;
  is_playable: boolean;
};

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Validasi video asset nyata: durasi, dimensi, dan tipe konten harus terbaca.
 * Thumbnail, HTML, atau placeholder akan gagal di sini (is_playable = false).
 */
export async function probeVideoAsset(url: string): Promise<VideoAssetProbe> {
  let mime = "";
  let size = 0;
  try {
    const head = await fetch(url, { method: "HEAD" });
    mime = head.headers.get("content-type") ?? "";
    size = Number(head.headers.get("content-length") ?? 0) || 0;
  } catch {
    /* HEAD tidak wajib berhasil; validasi utama tetap dari elemen video */
  }
  if (mime && !mime.startsWith("video/")) {
    return {
      duration: 0,
      width: 0,
      height: 0,
      aspect_ratio: "",
      mime_type: mime,
      file_size: size,
      is_playable: false,
    };
  }

  const video = await loadVideo(url).catch(() => null);
  const duration = video && Number.isFinite(video.duration) ? video.duration : 0;
  const width = video?.videoWidth ?? 0;
  const height = video?.videoHeight ?? 0;
  if (video) video.src = "";

  const divisor = width && height ? gcd(width, height) : 0;
  return {
    duration: Math.round(duration * 100) / 100,
    width,
    height,
    aspect_ratio: divisor ? `${width / divisor}:${height / divisor}` : "",
    mime_type: mime,
    file_size: size,
    is_playable: duration > 0 && width > 0 && height > 0,
  };
}

export function formatTimestamp(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/** Jumlah snapshot mengikuti aturan durasi: 15s → 6-8, 30s → 8-12, 60s → 12-16. */
export function snapshotCount(duration: number): number {
  if (duration <= 15) return 7;
  if (duration <= 30) return 10;
  if (duration <= 60) return 14;
  return Math.min(24, Math.round(duration / 4));
}

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    video.onloadedmetadata = () => resolve(video);
    video.onerror = () => reject(new Error("Video sumber tidak dapat dibaca."));
  });
}

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = () => {
      video.removeEventListener("seeked", done);
      resolve();
    };
    video.addEventListener("seeked", done);
    video.onerror = () => reject(new Error("Gagal memindai frame video."));
    video.currentTime = Math.min(time, Math.max(0, (video.duration || 0) - 0.05));
  });
}

/**
 * Prioritas frame: 3 detik pertama (hook), lalu sebaran merata sepanjang video,
 * dan 2 detik terakhir (CTA).
 */
export async function extractFrames(
  videoUrl: string,
  onProgress?: (done: number, total: number) => void,
): Promise<{ frames: FrameCapture[]; duration: number }> {
  const video = await loadVideo(videoUrl);
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  if (!duration) throw new Error("Durasi video tidak terbaca.");

  const total = snapshotCount(duration);
  const hookCount = Math.min(3, total);
  const times: Array<{ t: number; reason: string }> = [];
  for (let i = 0; i < hookCount; i += 1) {
    times.push({ t: Math.min(duration - 0.1, i + 0.3), reason: "Hook 3 detik awal" });
  }
  const remaining = total - hookCount - 1;
  for (let i = 1; i <= Math.max(0, remaining); i += 1) {
    const t = 3 + ((duration - 5) * i) / (remaining + 1);
    if (t > 3 && t < duration - 1) times.push({ t, reason: "Pergantian scene / informasi" });
  }
  times.push({ t: Math.max(0, duration - 1), reason: "Penutup / CTA" });

  const canvas = document.createElement("canvas");
  const width = 640;
  const scale = width / (video.videoWidth || width);
  canvas.width = width;
  canvas.height = Math.round((video.videoHeight || 1138) * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas tidak tersedia di browser ini.");

  const frames: FrameCapture[] = [];
  for (const [index, item] of times.entries()) {
    await seek(video, item.t);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.72),
    );
    if (blob) {
      frames.push({
        timestamp: formatTimestamp(item.t),
        seconds: item.t,
        reason: item.reason,
        blob,
      });
    }
    onProgress?.(index + 1, times.length);
  }
  video.src = "";
  return { frames, duration };
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

/** Potong audio video menjadi WAV 15 detik agar transkrip punya timestamp nyata. */
export async function extractAudioChunks(
  videoUrl: string,
  chunkSeconds = 15,
): Promise<AudioChunk[]> {
  const response = await fetch(videoUrl);
  const raw = await response.arrayBuffer();
  const AudioCtx: typeof AudioContext =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(raw);
  } catch {
    await ctx.close();
    return []; // video tanpa audio atau codec tidak didukung browser
  }

  const target = 16000;
  const channel = decoded.getChannelData(0);
  const ratio = decoded.sampleRate / target;
  const chunks: AudioChunk[] = [];

  for (let start = 0; start < decoded.duration; start += chunkSeconds) {
    const from = Math.floor(start * decoded.sampleRate);
    const to = Math.min(channel.length, Math.floor((start + chunkSeconds) * decoded.sampleRate));
    if (to - from < decoded.sampleRate) continue; // potongan < 1 detik diabaikan
    const outLength = Math.floor((to - from) / ratio);
    const out = new Float32Array(outLength);
    let peak = 0;
    for (let i = 0; i < outLength; i += 1) {
      const sample = channel[from + Math.floor(i * ratio)] ?? 0;
      out[i] = sample;
      peak = Math.max(peak, Math.abs(sample));
    }
    if (peak < 0.005) continue; // potongan senyap
    chunks.push({
      timestamp: formatTimestamp(start),
      seconds: start,
      blob: encodeWav(out, target),
    });
  }

  await ctx.close();
  return chunks;
}

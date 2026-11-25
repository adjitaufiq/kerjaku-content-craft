export type ProductionMode = "economy" | "hybrid" | "cinematic";
export type AssetRef = { bucket: string; path: string; userId: string; mimeType: string; checksum: string; bytes: number };
export type MediaJobContext = { jobId: string; idempotencyKey: string; userId: string; mode: ProductionMode; budgetCredits: number; signal: AbortSignal; onProgress: (percent: number) => Promise<void> };
export type WordTiming = { word: string; startMs: number; endMs: number };
export interface ImageProvider { generate(input: { prompt: string; width: number; height: number }, context: MediaJobContext): Promise<AssetRef>; }
export interface VoiceProvider { speak(input: { text: string; language: string; voice: string; direction: string }, context: MediaJobContext): Promise<{ audio: AssetRef; durationMs: number }>; }
export interface SubtitleProvider { align(input: { audio: AssetRef; script: string }, context: MediaJobContext): Promise<{ words: WordTiming[]; srt: AssetRef; vtt: AssetRef }>; }
export interface VideoGenerationProvider { generate(input: { prompt: string; image?: AssetRef; durationSeconds: number }, context: MediaJobContext): Promise<AssetRef>; }
export interface VideoRenderProvider { render(input: { scenes: Array<{ asset: AssetRef; durationMs: number }>; voice: AssetRef; subtitles: WordTiming[]; width: number; height: number; fps: number }, context: MediaJobContext): Promise<AssetRef>; }
export interface PublishingProvider { publish(input: { platform: "instagram" | "tiktok" | "youtube"; assets: AssetRef[]; caption: string; idempotencyKey: string }, context: MediaJobContext): Promise<{ platformPostId: string; url?: string }>; reconcile(input: { idempotencyKey: string; creationId: string }, context: MediaJobContext): Promise<{ state: "published" | "not_published" | "unknown"; platformPostId?: string }>; }
export type WorkerHeartbeat = { workerId: string; observedAt: string; activeJobIds: string[]; capabilities: Array<"image" | "voice" | "subtitle" | "render"> };
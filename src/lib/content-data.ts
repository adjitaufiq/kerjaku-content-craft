import { supabase } from "@/integrations/supabase/client";
import seed from "@/data/bank-konten.json";

export type BankRow = {
  no: number;
  title: string;
  prompt: string;
  caption: string;
};

export type ContentLog = {
  id: string;
  content_number: number;
  title: string;
  image_url: string | null;
  image_urls: string[] | null;
  caption: string;
  status: string;
  scheduled_at: string | null;
  ig_post_id: string | null;
  ig_creation_id: string | null;
  error_message: string | null;
  created_at: string;
};

export const seedBank = seed as BankRow[];

export async function fetchBank(): Promise<BankRow[]> {
  const { data, error } = await supabase
    .from("content_bank")
    .select("content_number, title, prompt, caption")
    .order("content_number", { ascending: true });
  if (error) throw error;
  if (!data?.length) return seedBank;
  return data.map((r) => ({
    no: r.content_number,
    title: r.title,
    prompt: r.prompt,
    caption: r.caption,
  }));
}

export async function saveBank(rows: BankRow[]) {
  const payload = rows.map((r) => ({
    content_number: r.no,
    title: r.title,
    prompt: r.prompt,
    caption: r.caption,
  }));
  const { error } = await supabase
    .from("content_bank")
    .upsert(payload, { onConflict: "content_number" });
  if (error) throw error;
}

export async function fetchLogs(): Promise<ContentLog[]> {
  const { data, error } = await supabase
    .from("content_logs")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ContentLog[];
}

/** Latest log per content number. */
export function indexLogs(logs: ContentLog[]) {
  const map = new Map<number, ContentLog>();
  for (const log of logs) {
    if (!map.has(log.content_number)) map.set(log.content_number, log);
  }
  return map;
}

/** All photos of a log, falling back to the legacy single photo. */
export function imagesOf(log: { image_urls?: string[] | null; image_url?: string | null }) {
  if (log.image_urls?.length) return log.image_urls;
  return log.image_url ? [log.image_url] : [];
}

export function statusTone(status: string) {
  if (status === "published") return "bg-accent/15 text-accent border-accent/40";
  if (status === "scheduled") return "bg-primary/15 text-primary border-primary/40";
  if (status === "failed") return "bg-destructive/15 text-destructive border-destructive/40";
  return "bg-muted text-muted-foreground border-border";
}

export function detectNumberFromFilename(name: string): number | null {
  const match = name.match(/(\d{1,3})/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

export async function uploadImage(file: File, contentNumber: number) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const path = `content-${contentNumber}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("instagram-media")
    .upload(path, file, { upsert: true, contentType: file.type || "image/png" });
  if (error) throw error;
  const { data, error: signErr } = await supabase.storage
    .from("instagram-media")
    .createSignedUrl(path, 60 * 60 * 24 * 30);
  if (signErr || !data?.signedUrl) throw signErr ?? new Error("Gagal membuat URL gambar.");
  return data.signedUrl;
}

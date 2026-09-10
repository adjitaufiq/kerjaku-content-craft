import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const SOURCE_STATUSES = [
  "draft",
  "processing",
  "understanding",
  "source_extracted",
  "analysis_complete",
  "production",
  "approved",
  "published",
  "failed",
] as const;
export type SourceStatus = (typeof SOURCE_STATUSES)[number];

export const SOURCE_PLATFORMS = [
  { value: "upload", label: "Upload Manual" },
  { value: "instagram", label: "Instagram Reel" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube_shorts", label: "YouTube Shorts" },
] as const;

export const SOURCE_CATEGORIES = [
  "Hook Reference",
  "Storytelling",
  "Sales Content",
  "Educational",
  "Branding",
  "Viral Reference",
] as const;

/** Video sumber bersifat sementara: 3 hari sejak dibuat. */
export const SOURCE_RETENTION_DAYS = 3;

export type ViralSource = {
  id: string;
  platform: string;
  source_url: string | null;
  creator_name: string | null;
  title: string;
  category: string | null;
  notes: string;
  thumbnail_url: string | null;
  video_path: string | null;
  status: SourceStatus;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export const listViralSources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ViralSource[]> => {
    const { data, error } = await context.supabase
      .from("viral_sources")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as ViralSource[];
  });

function validSourceUrl(platform: string, url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if (platform === "instagram") return host.endsWith("instagram.com");
    if (platform === "tiktok") return host.endsWith("tiktok.com");
    if (platform === "youtube_shorts")
      return host.endsWith("youtube.com") || host.endsWith("youtu.be");
    return true;
  } catch {
    return false;
  }
}

export const createViralSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      title: string;
      platform: string;
      sourceUrl?: string | null;
      creatorName?: string | null;
      category?: string | null;
      notes?: string | null;
      videoPath?: string | null;
      thumbnailUrl?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const title = data.title.trim();
    if (!title) throw new Error("Judul sumber wajib diisi.");

    const sourceUrl = data.sourceUrl?.trim() || null;
    const videoPath = data.videoPath?.trim() || null;
    if (!sourceUrl && !videoPath) {
      throw new Error("Unggah video atau isi tautan sumber terlebih dahulu.");
    }
    if (sourceUrl && !validSourceUrl(data.platform, sourceUrl)) {
      throw new Error("Tautan tidak cocok dengan platform yang dipilih.");
    }

    const expiresAt = videoPath
      ? new Date(Date.now() + SOURCE_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { data: created, error } = await context.supabase
      .from("viral_sources")
      .insert({
        user_id: context.userId,
        title,
        platform: data.platform,
        source_url: sourceUrl,
        creator_name: data.creatorName?.trim() || null,
        category: data.category?.trim() || null,
        notes: data.notes?.trim() || "",
        video_path: videoPath,
        thumbnail_url: data.thumbnailUrl?.trim() || null,
        status: "draft",
        expires_at: expiresAt,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });

export const updateViralSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id: string;
      status?: SourceStatus;
      category?: string | null;
      notes?: string | null;
      creatorName?: string | null;
      title?: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const patch: {
      status?: SourceStatus;
      category?: string | null;
      notes?: string;
      creator_name?: string | null;
      title?: string;
    } = {};
    if (data.status) patch.status = data.status;
    if (data.category !== undefined) patch.category = data.category?.trim() || null;
    if (data.notes !== undefined) patch.notes = data.notes?.trim() ?? "";
    if (data.creatorName !== undefined) patch.creator_name = data.creatorName?.trim() || null;
    if (data.title !== undefined) patch.title = data.title.trim();

    const { error } = await context.supabase.from("viral_sources").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteViralSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("viral_sources")
      .select("video_path")
      .eq("id", data.id)
      .maybeSingle();

    const { error } = await context.supabase.from("viral_sources").delete().eq("id", data.id);
    if (error) throw new Error(error.message);

    if (row?.video_path) {
      await context.supabase.storage.from("viral-sources").remove([row.video_path]);
    }
    return { ok: true };
  });

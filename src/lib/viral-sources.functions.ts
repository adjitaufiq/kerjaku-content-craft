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
  "ready_for_prompt_generation",
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
    // Auto-clean: proses yang macet lebih dari 5 menit tidak boleh tampil "Processing" selamanya.
    const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    await context.supabase
      .from("viral_sources")
      .update({ status: "failed" })
      .in("status", ["processing", "understanding"])
      .lt("updated_at", cutoff);

    const { data, error } = await context.supabase
      .from("viral_sources")
      .select("*")
      .is("deleted_at", null)
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

/** Soft delete: source disembunyikan dari daftar, pembersihan permanen bisa menyusul. */
export const deleteViralSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    // Hentikan proses berjalan agar tidak ada job yang melanjutkan source ini.
    await context.supabase
      .from("source_extractions")
      .update({
        verification_status: "failed",
        pipeline_stage: "ANALYSIS_FAILED",
        error_message: "Source dihapus oleh pengguna.",
      })
      .eq("source_id", data.id)
      .eq("verification_status", "processing");

    const { error } = await context.supabase
      .from("viral_sources")
      .update({ deleted_at: new Date().toISOString(), status: "failed" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Pembersihan permanen: hapus seluruh hasil analisis, Viral DNA, ATM, dan file terkait. */
export const purgeViralSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("viral_sources")
      .select("video_path")
      .eq("id", data.id)
      .maybeSingle();

    const { data: extraction } = await context.supabase
      .from("source_extractions")
      .select("snapshot_data")
      .eq("source_id", data.id)
      .maybeSingle();

    await context.supabase.from("source_extraction_archives").delete().eq("source_id", data.id);
    await context.supabase.from("source_extractions").delete().eq("source_id", data.id);
    await context.supabase.from("viral_intelligence").delete().eq("source_id", data.id);

    const { data: versions } = await context.supabase
      .from("kerjaku_versions")
      .select("id")
      .eq("source_id", data.id);
    const versionIds = (versions ?? []).map((v) => v.id);
    if (versionIds.length) {
      const { data: libs } = await context.supabase
        .from("content_library")
        .select("id")
        .in("version_id", versionIds);
      const libIds = (libs ?? []).map((l) => l.id);
      if (libIds.length) {
        await context.supabase.from("content_performance").delete().in("content_id", libIds);
        await context.supabase.from("content_library").delete().in("id", libIds);
      }
      await context.supabase.from("quality_scores").delete().in("version_id", versionIds);
      await context.supabase
        .from("content_production_results")
        .delete()
        .in("version_id", versionIds);
      await context.supabase.from("video_storyboards").delete().in("version_id", versionIds);
      await context.supabase.from("kerjaku_versions").delete().in("id", versionIds);
    }

    const { error } = await context.supabase.from("viral_sources").delete().eq("id", data.id);
    if (error) throw new Error(error.message);

    const paths: string[] = [];
    if (row?.video_path) paths.push(row.video_path);
    if (Array.isArray(extraction?.snapshot_data)) {
      for (const snap of extraction.snapshot_data as Array<{ path?: string }>) {
        if (typeof snap?.path === "string") paths.push(snap.path);
      }
    }
    if (paths.length) {
      await context.supabase.storage.from("viral-sources").remove(paths);
    }
    return { ok: true };
  });

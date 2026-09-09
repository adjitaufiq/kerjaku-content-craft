import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DownloadRow = {
  id: string;
  source_platform: string;
  source_url: string;
  creator_username: string | null;
  content_type: string;
  caption: string;
  thumbnail_url: string | null;
  video_url: string | null;
  thumbnail_path: string | null;
  video_path: string | null;
  resolution: string | null;
  duration: number | null;
  category: string | null;
  notes: string;
  tags: string[];
  is_favorite: boolean;
  hook_analysis: string | null;
  content_structure: string | null;
  cta_analysis: string | null;
  editing_style: string | null;
  audience_type: string | null;
  viral_pattern: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
};

export const listDownloads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DownloadRow[]> => {
    const { data, error } = await context.supabase
      .from("content_downloads")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as DownloadRow[];
  });

/**
 * Validates the URL, reads public metadata, stores thumbnail (and video when
 * Instagram exposes a public file) in the private research bucket.
 */
export const analyzeAndDownload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { url: string; download: boolean }) => input)
  .handler(async ({ data, context }): Promise<{ id: string; status: string; message: string }> => {
    const { normalizeUrl, extractPublicMetadata, storeRemoteAsset } = await import(
      "./downloads.server"
    );
    const { url, contentType } = normalizeUrl(data.url);

    const { data: created, error: insertError } = await context.supabase
      .from("content_downloads")
      .insert({ source_url: url, content_type: contentType, status: "processing" })
      .select("id")
      .single();
    if (insertError) throw new Error(insertError.message);
    const id = created.id as string;

    try {
      const media = await extractPublicMetadata(url, contentType);

      let thumbnailPath: string | null = null;
      let videoPath: string | null = null;
      if (data.download) {
        if (media.thumbnailUrl) {
          thumbnailPath = (await storeRemoteAsset(media.thumbnailUrl, id, "thumbnail.jpg"))?.path ?? null;
        }
        if (media.videoUrl) {
          videoPath = (await storeRemoteAsset(media.videoUrl, id, "video.mp4"))?.path ?? null;
        }
      }

      await context.supabase
        .from("content_downloads")
        .update({
          creator_username: media.creatorUsername,
          caption: media.caption,
          thumbnail_url: media.thumbnailUrl,
          video_url: media.videoUrl,
          thumbnail_path: thumbnailPath,
          video_path: videoPath,
          resolution: media.resolution,
          duration: media.duration,
          status: "completed",
          error_message: null,
        })
        .eq("id", id);

      return {
        id,
        status: "completed",
        message: videoPath
          ? "Referensi tersimpan lengkap dengan file videonya."
          : data.download
            ? "Metadata dan thumbnail tersimpan. Video tidak dibagikan publik — unggah filenya manual bila perlu."
            : "Metadata publik berhasil dibaca.",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal memproses tautan.";
      const { isMissingPreview } = await import("./downloads.server");
      // Instagram sering menutup pratinjau publik. Tautannya sendiri tetap valid,
      // jadi referensi disimpan agar bisa dilengkapi manual.
      if (isMissingPreview(message)) {
        await context.supabase
          .from("content_downloads")
          .update({ status: "completed", error_message: null })
          .eq("id", id);
        return {
          id,
          status: "completed",
          message:
            "Instagram tidak membagikan pratinjau untuk tautan ini. Referensi tetap tersimpan — lengkapi caption, catatan, dan videonya secara manual.",
        };
      }
      await context.supabase
        .from("content_downloads")
        .update({ status: "failed", error_message: message })
        .eq("id", id);
      return { id, status: "failed", message };
    }

  });

export const updateDownloadMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id: string;
      category?: string | null;
      notes?: string;
      tags?: string[];
      is_favorite?: boolean;
      video_path?: string | null;
      hook_analysis?: string | null;
      content_structure?: string | null;
      cta_analysis?: string | null;
      editing_style?: string | null;
      audience_type?: string | null;
      viral_pattern?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    const { error } = await context.supabase.from("content_downloads").update(clean).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteDownload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.storage
      .from("content-research")
      .remove([`${data.id}/thumbnail.jpg`, `${data.id}/video.mp4`]);
    const { error } = await context.supabase.from("content_downloads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Creates the next content-bank entry from a saved reference. */
export const addToContentBank = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }): Promise<{ contentNumber: number }> => {
    const { data: ref, error: refError } = await context.supabase
      .from("content_downloads")
      .select("caption, creator_username, category, source_url")
      .eq("id", data.id)
      .single();
    if (refError || !ref) throw new Error("Referensi tidak ditemukan.");

    const { data: last } = await context.supabase
      .from("content_bank")
      .select("content_number")
      .order("content_number", { ascending: false })
      .limit(1);
    const { data: lastLog } = await context.supabase
      .from("content_logs")
      .select("content_number")
      .order("content_number", { ascending: false })
      .limit(1);
    const seed = (await import("@/data/bank-konten.json")).default as { no: number }[];
    const seedMax = seed.reduce((max, row) => Math.max(max, row.no), 0);
    const nextNumber =
      Math.max(last?.[0]?.content_number ?? 0, lastLog?.[0]?.content_number ?? 0, seedMax) + 1;


    const title = `Referensi ${ref.category ?? "Riset"}${
      ref.creator_username ? ` — @${ref.creator_username}` : ""
    }`;

    const { error } = await context.supabase.from("content_bank").insert({
      content_number: nextNumber,
      title,
      prompt: `Sumber referensi: ${ref.source_url}`,
      caption: ref.caption ?? "",
    });
    if (error) throw new Error(error.message);
    return { contentNumber: nextNumber };
  });

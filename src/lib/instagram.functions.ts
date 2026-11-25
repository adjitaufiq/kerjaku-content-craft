import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCraftAdmin } from "./authorization";
import { phase0Client } from "./phase0-db";

export const MAX_CAROUSEL = 10;
const publishInput = z.object({
  contentLogId: z.string().uuid(),
  imageUrls: z.array(z.string().max(4000)).min(1).max(MAX_CAROUSEL),
  caption: z.string().max(2200),
});

/** Manual publish and scheduled publish share the same durable server executor. */
export const publishToInstagram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof publishInput>) => publishInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireCraftAdmin(context.supabase, context.userId);
    const { data: content, error } = await context.supabase
      .from("content_logs")
      .select("*")
      .eq("id", data.contentLogId)
      .single();
    if (error || !content || (content as unknown as { user_id: string }).user_id !== context.userId)
      throw new Error("Konten tidak ditemukan atau akses ditolak.");
    const { refreshAssetUrls } = await import("./asset-delivery.server");
    // Caller-owned signatures prove access before privileged queue/executor work.
    await refreshAssetUrls(context.supabase, data.imageUrls);
    const { data: existingJob, error: jobCheckError } = await phase0Client(context.supabase)
      .from("publishing_jobs")
      .select("id")
      .eq("content_log_id", content.id)
      .maybeSingle();
    if (jobCheckError) throw new Error("Status antrean belum dapat diperiksa.");
    if (!existingJob) {
      const { error: updateError } = await context.supabase
        .from("content_logs")
        .update({
          image_urls: data.imageUrls,
          image_url: data.imageUrls[0] ?? null,
          caption: data.caption,
        })
        .eq("id", content.id);
      if (updateError) throw new Error("Perubahan konten tidak dapat disimpan.");
    }
    const { data: jobId, error: queueError } = await phase0Client(context.supabase).rpc(
      "enqueue_publish_job",
      { log_id: content.id },
    );
    if (queueError || !jobId)
      throw new Error("Antrean publikasi belum tersedia; konten tidak diposting.");
    const { runPublishingQueue } = await import("./publishing-queue.server");
    await runPublishingQueue(jobId);
    const { data: job, error: readError } = await phase0Client(context.supabase)
      .from("publishing_jobs")
      .select("state,creation_id,platform_post_id")
      .eq("id", jobId)
      .single();
    if (readError || !job)
      throw new Error(
        "Status publikasi belum dapat dipastikan. Jangan buat posting baru; periksa antrean.",
      );
    if (job.state !== "succeeded" || !job.platform_post_id || !job.creation_id)
      throw new Error(
        job.state === "reconciliation_required"
          ? "Publikasi perlu rekonsiliasi; tidak diulang otomatis."
          : "Publikasi masih tertunda atau gagal; periksa status konten.",
      );
    return {
      mode: "published" as const,
      creationId: job.creation_id,
      postId: job.platform_post_id,
    };
  });

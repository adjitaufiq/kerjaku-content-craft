import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { contentSchema } from "./content-bank";
import { campaignSchema } from "./factory-types";
import { factoryClient } from "./factory-db";
import { buildFactoryResults } from "./factory-results";
import { campaignFeedback } from "./factory-distribution";

export const loadFactory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = factoryClient(context.supabase);
    const [bank, campaigns, tasks, media, distribution] = await Promise.all([
      db.from("craft_bank").select("*").eq("user_id", context.userId).order("content_number"),
      db
        .from("craft_campaigns")
        .select("*")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(50),
      db.from("craft_tasks").select("*").eq("user_id", context.userId).order("ordinal"),
      db
        .from("craft_media")
        .select("*")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false }),
      db
        .from("craft_distribution")
        .select("*")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false }),
    ]);
    if (bank.error || campaigns.error || tasks.error || media.error || distribution.error)
      throw new Error(
        "Penyimpanan campaign belum siap. Draf Excel tetap tersedia; tidak ada data lama yang diubah.",
      );
    const documents = (bank.data ?? []).map((r) => contentSchema.parse(r.document));
    const { data: metrics, error: metricsError } = await db
      .from("craft_metric_snapshots")
      .select("platform_post_id,content_id,platform,measured_at,views,likes,comments,shares")
      .eq("user_id", context.userId)
      .order("measured_at", { ascending: false })
      .limit(100);
    const feedback = metricsError
      ? null
      : campaignFeedback(
          (metrics ?? []).map((m) => ({
            postId: m.platform_post_id,
            contentId: m.content_id,
            platform: m.platform,
            measuredAt: m.measured_at,
            views: m.views,
            likes: m.likes,
            comments: m.comments,
            shares: m.shares,
          })),
          documents,
        );
    return {
      bank: documents,
      results: buildFactoryResults(
        tasks.data ?? [],
        media.data ?? [],
        distribution.data ?? [],
        documents,
      ),
      analytics: {
        available: !metricsError,
        measuredPosts: new Set(
          (metrics ?? [])
            .filter((m) => m.platform_post_id && m.views !== null)
            .map((m) => `${m.platform}:${m.platform_post_id}`),
        ).size,
        recommendations: feedback?.recommendations ?? [],
      },
      campaigns: (campaigns.data ?? []).map((c) => ({
        ...c,
        tasks: (tasks.data ?? [])
          .filter((t) => t.campaign_id === c.id)
          .map(({ output: _output, ...task }) => task),
      })),
      media: media.data ?? [],
      distribution: distribution.data ?? [],
    };
  });
export const saveFactoryBank = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.array(contentSchema).parse(data))
  .handler(async ({ data, context }) => {
    const { data: count, error } = await factoryClient(context.supabase).rpc("craft_save_bank", {
      documents: data,
    });
    if (error) throw new Error(`Bank belum tersimpan: ${error.message}`);
    return { count };
  });
export const createFactoryCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => campaignSchema.parse(data))
  .handler(async ({ data, context }) => {
    if (data.mode !== "economy")
      throw new Error(
        "Suara Hybrid/Cinematic belum tersedia; gunakan Economy sampai penyedia suara natural diaktifkan.",
      );
    if (data.seedContents.some((r) => r.production.category === "Trending"))
      throw new Error(
        "Bukti tren platform belum terverifikasi; naskah Trending ditahan, bukan dilabeli otomatis.",
      );
    const { data: id, error } = await factoryClient(context.supabase).rpc("craft_create_campaign", {
      command_text: data.command,
      campaign_config: data,
      item_count: data.count,
    });
    if (error || !id)
      throw new Error(
        "Campaign belum dibuat: Lovable Cloud dan penyimpanan produksi harus aktif. Tidak ada produksi atau publikasi yang diklaim berhasil.",
      );
    return { id };
  });
export const getFactoryAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: asset, error } = await factoryClient(context.supabase)
      .from("craft_media")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .single();
    if (error || !asset) throw new Error("Media tidak ditemukan.");
    const { data: signed, error: signError } = await context.supabase.storage
      .from(asset.bucket)
      .createSignedUrl(asset.path, 3600);
    if (signError || !signed) throw new Error("Media belum dapat diakses.");
    return { url: signed.signedUrl };
  });

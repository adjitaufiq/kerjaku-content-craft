import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildPerformanceInsight,
  type Baseline,
  type PerformanceInsight,
  type PerformanceRow,
} from "@/lib/performance-insight";

export type MeasurementPeriod = "24h" | "7d" | "30d";

export type PerformanceInput = {
  contentId: string;
  period: MeasurementPeriod;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
};

const BASELINE_WINDOW_DAYS = 30;

function engagementRate(input: PerformanceInput): number {
  if (input.views <= 0) return 0;
  const interactions = input.likes + input.comments + input.shares + input.saves;
  return Number(((interactions / input.views) * 100).toFixed(2));
}

function ctaTypesFrom(assets: unknown): string[] {
  const bucket = (assets as Record<string, unknown> | null)?.["cta"];
  const list = Array.isArray(bucket) ? bucket : [];
  return list
    .map((entry) => {
      if (typeof entry === "string") return entry;
      const record = entry as Record<string, unknown>;
      const value = record["cta_type"] ?? record["type"];
      return typeof value === "string" ? value : "";
    })
    .filter(Boolean);
}

/** Catat atau perbarui metrik satu konten pada periode tertentu, lalu hitung ulang baseline akun. */
export const recordPerformance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: PerformanceInput) => input)
  .handler(async ({ data, context }): Promise<{ ok: true; engagement_rate: number }> => {
    const supabase = context.supabase;
    const rate = engagementRate(data);

    const { data: existing, error: existingError } = await supabase
      .from("content_performance")
      .select("id")
      .eq("content_id", data.contentId)
      .eq("measurement_period", data.period)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);

    const payload = {
      user_id: context.userId,
      content_id: data.contentId,
      measurement_period: data.period,
      views: Math.max(0, Math.round(data.views)),
      likes: Math.max(0, Math.round(data.likes)),
      comments: Math.max(0, Math.round(data.comments)),
      shares: Math.max(0, Math.round(data.shares)),
      saves: Math.max(0, Math.round(data.saves)),
      engagement_rate: rate,
      measured_at: new Date().toISOString(),
    };

    const { error } = existing
      ? await supabase.from("content_performance").update(payload).eq("id", existing.id)
      : await supabase.from("content_performance").insert(payload);
    if (error) throw new Error(error.message);

    await recomputeBaseline(context.userId);
    return { ok: true, engagement_rate: rate };
  });

    async function recomputeBaseline(userId: string): Promise<Baseline> {
  const since = new Date(Date.now() - BASELINE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("content_performance")
    .select("views,engagement_rate,measured_at")
    .eq("measurement_period", "24h")
    .gte("measured_at", since);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as { views: number; engagement_rate: number }[];
  const sample = rows.length;
  const avgViews = sample ? Math.round(rows.reduce((a, b) => a + b.views, 0) / sample) : 0;
  const avgRate = sample
    ? Number((rows.reduce((a, b) => a + Number(b.engagement_rate), 0) / sample).toFixed(2))
    : 0;

  const { data: existing, error: existingError } = await supabase
    .from("account_baseline")
    .select("id")
    .eq("window_days", BASELINE_WINDOW_DAYS)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  const payload = {
    user_id: userId,
    window_days: BASELINE_WINDOW_DAYS,
    avg_views: avgViews,
    avg_engagement_rate: avgRate,
    sample_size: sample,
  };
  const { error: writeError } = existing
    ? await supabase.from("account_baseline").update(payload).eq("id", existing.id)
    : await supabase.from("account_baseline").insert(payload);
  if (writeError) throw new Error(writeError.message);

  return { avg_views: avgViews, avg_engagement_rate: avgRate, sample_size: sample };
    }
  });

export const getPerformanceInsight = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PerformanceInsight> => {
    const supabase = context.supabase;
    const [library, performance, baseline] = await Promise.all([
      supabase.from("content_library").select("id,title,hook_type,atm_mode,category,content_assets"),
      supabase.from("content_performance").select("*"),
      supabase.from("account_baseline").select("*").eq("window_days", BASELINE_WINDOW_DAYS).maybeSingle(),
    ]);
    const error = library.error ?? performance.error ?? baseline.error;
    if (error) throw new Error(error.message);

    const preferred = new Map<string, (typeof performance.data)[number]>();
    for (const entry of performance.data ?? []) {
      const current = preferred.get(entry.content_id);
      const rank = (period: string) => (period === "24h" ? 3 : period === "7d" ? 2 : 1);
      if (!current || rank(entry.measurement_period) > rank(current.measurement_period)) {
        preferred.set(entry.content_id, entry);
      }
    }

    const rows: PerformanceRow[] = (library.data ?? [])
      .filter((item) => preferred.has(item.id))
      .map((item) => {
        const metric = preferred.get(item.id)!;
        return {
          content_id: item.id,
          title: item.title,
          hook_type: item.hook_type,
          atm_mode: item.atm_mode,
          category: item.category,
          cta_types: ctaTypesFrom(item.content_assets),
          views: metric.views,
          likes: metric.likes,
          comments: metric.comments,
          shares: metric.shares,
          saves: metric.saves,
          engagement_rate: Number(metric.engagement_rate),
        };
      });

    const base: Baseline = baseline.data
      ? {
          avg_views: Number(baseline.data.avg_views),
          avg_engagement_rate: Number(baseline.data.avg_engagement_rate),
          sample_size: baseline.data.sample_size,
        }
      : { avg_views: 0, avg_engagement_rate: 0, sample_size: 0 };

    return buildPerformanceInsight(rows, base);
  });

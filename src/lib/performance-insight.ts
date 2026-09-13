export const MIN_SAMPLE_SIZE = 5;

export type PerformanceRow = {
  content_id: string;
  title: string;
  hook_type: string;
  atm_mode: "conservative" | "creative";
  category: string | null;
  cta_types: string[];
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagement_rate: number;
};

export type Baseline = { avg_views: number; avg_engagement_rate: number; sample_size: number };

export type InsightGroup = {
  label: string;
  sample_size: number;
  avg_views: number;
  avg_engagement_rate: number;
  performance_index: number;
  insight: string;
};

export type PerformanceInsight = {
  status: "ready" | "insufficient_data";
  message: string;
  sample_size: number;
  baseline: Baseline;
  topContent: Array<{ content_id: string; title: string; views: number; performance_index: number }>;
  byHook: InsightGroup[];
  byCta: InsightGroup[];
  byFormat: InsightGroup[];
};

const avg = (values: number[]) => (values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length);
const round = (value: number, digits = 2) => Number(value.toFixed(digits));

export function performanceIndex(views: number, baselineViews: number): number {
  if (baselineViews <= 0) return 0;
  return round(views / baselineViews);
}

function groupBy(rows: PerformanceRow[], keyOf: (row: PerformanceRow) => string[], baseline: Baseline): InsightGroup[] {
  const buckets = new Map<string, PerformanceRow[]>();
  for (const row of rows) {
    for (const key of keyOf(row)) {
      if (!key) continue;
      buckets.set(key, [...(buckets.get(key) ?? []), row]);
    }
  }
  return [...buckets.entries()]
    .map(([label, group]) => {
      const groupViews = avg(group.map((row) => row.views));
      const index = performanceIndex(groupViews, baseline.avg_views);
      return {
        label,
        sample_size: group.length,
        avg_views: Math.round(groupViews),
        avg_engagement_rate: round(avg(group.map((row) => row.engagement_rate))),
        performance_index: index,
        insight:
          group.length < MIN_SAMPLE_SIZE
            ? `Data belum cukup (${group.length} dari ${MIN_SAMPLE_SIZE} konten).`
            : `${label} menghasilkan performa ${index}x baseline dari ${group.length} konten.`,
      };
    })
    .sort((a, b) => b.performance_index - a.performance_index);
}

/**
 * AI tidak mengambil keputusan; fungsi ini hanya meringkas data agar creator
 * yang memutuskan. Tanpa minimal 5 sample, tidak ada kesimpulan yang dibuat.
 */
export function buildPerformanceInsight(rows: PerformanceRow[], baseline: Baseline): PerformanceInsight {
  const computedBaseline: Baseline =
    baseline.avg_views > 0
      ? baseline
      : {
          avg_views: Math.round(avg(rows.map((row) => row.views))),
          avg_engagement_rate: round(avg(rows.map((row) => row.engagement_rate))),
          sample_size: rows.length,
        };

  if (rows.length < MIN_SAMPLE_SIZE) {
    return {
      status: "insufficient_data",
      message: `Insufficient data — butuh minimal ${MIN_SAMPLE_SIZE} konten terukur, saat ini ${rows.length}.`,
      sample_size: rows.length,
      baseline: computedBaseline,
      topContent: [],
      byHook: [],
      byCta: [],
      byFormat: [],
    };
  }

  return {
    status: "ready",
    message: `Ringkasan dari ${rows.length} konten terukur. Insight ini bersifat rekomendasi, keputusan tetap di tangan creator.`,
    sample_size: rows.length,
    baseline: computedBaseline,
    topContent: rows
      .map((row) => ({
        content_id: row.content_id,
        title: row.title,
        views: row.views,
        performance_index: performanceIndex(row.views, computedBaseline.avg_views),
      }))
      .sort((a, b) => b.performance_index - a.performance_index)
      .slice(0, 5),
    byHook: groupBy(rows, (row) => [row.hook_type || "tidak diketahui"], computedBaseline),
    byCta: groupBy(rows, (row) => row.cta_types, computedBaseline),
    byFormat: groupBy(rows, (row) => [row.atm_mode], computedBaseline),
  };
}

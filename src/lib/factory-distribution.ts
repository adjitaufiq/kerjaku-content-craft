import type { BankContent } from "./content-bank";
import type { CampaignInput, DistributionPackage, FactoryAsset } from "./factory-types";
import { productionFormats } from "./factory-plan";
import { buildPerformanceInsight, type PerformanceRow } from "./performance-insight";

export const PLATFORM_FORMATS = {
  instagram: ["Foto", "Carousel", "Video"],
  tiktok: ["Foto", "Carousel", "Video"],
  facebook: ["Foto", "Carousel", "Video"],
  youtube: ["Video"],
} as const;
export function buildDistributionPackages(config: CampaignInput, content: BankContent, assets: FactoryAsset[], campaignId: string, ordinal: number): DistributionPackage[] {
  if (!content.caption.trim()) throw new Error("Caption publikasi kosong");
  return config.platforms.flatMap((platform) => productionFormats(config, ordinal).map((format) => {
    const files = assets.filter((a) => format === "Video" ? a.kind === "video" : format === "Foto" ? a.path.endsWith("poster.jpg") : /carousel-\d+\.png$/.test(a.path)).sort((a, b) => a.path.localeCompare(b.path));
    const supported = PLATFORM_FORMATS[platform].some((f) => f === format);
    if (supported && files.length !== (format === "Carousel" ? config.slides : 1)) throw new Error(`Paket ${format} belum lengkap`);
    const reason = !supported ? "YouTube menerima video; gambar hanya dapat menjadi thumbnail, bukan posting carousel."
      : platform === "tiktok" ? "Menunggu izin Content Posting API, audit aplikasi dan verifikasi domain media; TikTok Connector ditunda."
      : platform === "instagram" ? "Menunggu verifikasi akun Instagram, izin publikasi dan aktivasi scheduler."
      : "Menunggu otorisasi akun, izin platform dan aktivasi scheduler.";
    return { id: `${campaignId}:${content.id}:${platform}:${format}`, campaignId, contentId: content.id, platform, format, title: content.title, caption: content.caption, hashtags: content.production.hashtags, assets: files, state: supported ? "awaiting_authorization" : "unsupported_format", reason };
  }));
}

export type MeasuredPublication = { postId: string; contentId: string; platform: string; views: number | null; likes: number | null; comments: number | null; shares: number | null; measuredAt: string };
export function campaignFeedback(publications: MeasuredPublication[], contents: BankContent[]) {
  const latest = new Map<string, MeasuredPublication>();
  for (const publication of publications) {
    if (!publication.postId || publication.views === null) continue;
    const key = `${publication.platform}:${publication.postId}`;
    const previous = latest.get(key);
    if (!previous || publication.measuredAt > previous.measuredAt) latest.set(key, publication);
  }
  const rows: PerformanceRow[] = [];
  for (const p of latest.values()) {
    const content = contents.find((c) => c.id === p.contentId);
    if (!content || p.views === null) continue;
    const total = (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0);
    rows.push({ content_id: content.id, title: content.title, hook_type: content.production.hook, atm_mode: "conservative", category: content.production.category, cta_types: [content.production.cta], views: p.views, likes: p.likes ?? 0, comments: p.comments ?? 0, shares: p.shares ?? 0, saves: 0, engagement_rate: p.views > 0 ? total / p.views * 100 : 0 });
  }
  const insight = buildPerformanceInsight(rows, { avg_views: 0, avg_engagement_rate: 0, sample_size: rows.length });
  return { insight, recommendations: insight.status === "ready" ? insight.topContent.map((top) => ({ sourceContentId: top.content_id, hypothesis: `Uji variasi hook dan visual untuk ${top.title}; performa views ${top.performance_index}x baseline, bukan bukti sebab-akibat.`, nextCommand: `Buat variasi konten KERJAKU dari topik ${top.title}, hook dan visual berbeda; tanpa klaim retention atau viral yang tidak terukur.` })) : [] };
}
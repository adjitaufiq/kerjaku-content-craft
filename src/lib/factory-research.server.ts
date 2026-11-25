import { z } from "zod";
import type { ResearchSource } from "./factory-types";
const feedSchema = z.object({ hits: z.array(z.object({ title: z.string().nullable(), url: z.string().nullable(), objectID: z.string(), created_at: z.string(), points: z.number().nullable(), num_comments: z.number().nullable() })) });
export async function researchCampaign(command: string, ordinal: number): Promise<ResearchSource[]> {
  const query = command.replace(/^\d+\s+Konten\s+/i, "").slice(0, 140);
  const response = await fetch(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=30`, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`RESEARCH_SOURCE_UNAVAILABLE_${response.status}`);
  const feed = feedSchema.parse(await response.json());
  const sources = feed.hits.filter((h) => Boolean(h.title));
  if (!sources.length) throw new Error("Riset belum menemukan sumber relevan; pekerjaan ditahan, bukan dibuat seolah sedang tren.");
  return sources.slice((ordinal - 1) % Math.max(1, sources.length - 2), (ordinal - 1) % Math.max(1, sources.length - 2) + 3).map((h) => ({ title: h.title ?? "", url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`, publishedAt: h.created_at, observedAt: new Date().toISOString(), evidence: `Sumber diskusi teknologi: ${h.points ?? 0} points, ${h.num_comments ?? 0} komentar. Ini bukan bukti tren TikTok/Instagram.` }));
}
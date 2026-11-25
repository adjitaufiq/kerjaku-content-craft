import { describe, expect, it } from "vitest";
import { campaignSchema, type FactoryAsset } from "./factory-types";
import { contentSchema } from "./content-bank";
import { buildDistributionPackages, campaignFeedback } from "./factory-distribution";
import { qualityCheckBundle, nextFactoryStage } from "./factory-policy";

const config = campaignSchema.parse({
  command: "10 Konten Edukasi AI Automation untuk KERJAKU",
  count: 10,
  audience: "Pemilik bisnis Indonesia",
  platforms: ["instagram", "tiktok", "facebook", "youtube"],
  slides: 7,
});
const content = contentSchema.parse({
  id: "content-1",
  no: 31,
  title: "AI Automation",
  prompt: "Visual",
  caption: "Caption dari naskah asli",
  classification: "PERSONAL_CONTENT",
  production: {
    hook: "Mulai satu proses",
    script: "Narasi",
    voiceOver: "Narasi",
    hashtags: "#KERJAKU",
    scenes: "[]",
  },
});
const image = (name: string): FactoryAsset => ({
  kind: "image",
  bucket: "private",
  path: `owner/factory/${name}`,
  mime: name.endsWith("jpg") ? "image/jpeg" : "image/png",
  bytes: 100,
  checksum: "a".repeat(64),
  duration: null,
});
const assets: FactoryAsset[] = [
  image("poster.png"),
  image("poster.jpg"),
  ...Array.from({ length: 7 }, (_, i) => image(`carousel-${String(i + 1).padStart(2, "0")}.png`)),
  { ...image("video.mp4"), kind: "video", mime: "video/mp4", duration: 20 },
];

describe("Factory distribution handoff and measured learning", () => {
  it("retains original caption, hashtags and content identity across all three lanes", () => {
    const packages = buildDistributionPackages(config, content, assets, "campaign-1", 1);
    expect(packages).toHaveLength(12);
    expect(
      packages.every(
        (p) =>
          p.caption === "Caption dari naskah asli" &&
          p.hashtags === "#KERJAKU" &&
          p.contentId === "content-1",
      ),
    ).toBe(true);
  });
  it("holds all TikTok lanes without connecting or assuming publishing permission", () => {
    expect(
      buildDistributionPackages(config, content, assets, "campaign-1", 1)
        .filter((p) => p.platform === "tiktok")
        .map((p) => p.state),
    ).toEqual(["awaiting_authorization", "awaiting_authorization", "awaiting_authorization"]);
  });
  it("does not send photos and carousels to YouTube as publishable video", () => {
    expect(
      buildDistributionPackages(config, content, assets, "campaign-1", 1)
        .filter((p) => p.platform === "youtube")
        .map((p) => p.state),
    ).toEqual(["unsupported_format", "unsupported_format", "awaiting_authorization"]);
  });
  it("rejects a seven-slide distribution package missing the seventh image", () => {
    expect(() =>
      buildDistributionPackages(
        config,
        content,
        assets.filter((a) => !a.path.endsWith("carousel-07.png")),
        "campaign-1",
        1,
      ),
    ).toThrow("belum lengkap");
  });
  it("never marks production as analytics execution before a verified publication exists", () => {
    expect(nextFactoryStage("distribution")).toBe("complete");
    expect(campaignFeedback([], [content]).recommendations).toEqual([]);
  });
  it("does not derive learning from generated or unmeasured publication rows", () => {
    const measurement = {
      postId: "",
      contentId: content.id,
      platform: "instagram",
      measuredAt: "2026-11-25T00:00:00Z",
      views: 100,
      likes: 10,
      comments: 0,
      shares: 2,
    };
    expect(campaignFeedback([measurement], [content]).insight.sample_size).toBe(0);
    expect(
      campaignFeedback([{ ...measurement, postId: "official-id", views: null }], [content]).insight
        .sample_size,
    ).toBe(0);
  });
  it("deduplicates periodic snapshots before deriving next-campaign recommendations", () => {
    const contents = Array.from({ length: 5 }, (_, i) => ({
      ...content,
      id: `content-${i}`,
      title: `Topik ${i}`,
    }));
    const snapshots = contents.flatMap((c, i) => [
      {
        postId: `post-${i}`,
        contentId: c.id,
        platform: "instagram",
        measuredAt: "2026-11-24T00:00:00Z",
        views: 10,
        likes: 1,
        comments: 0,
        shares: 0,
      },
      {
        postId: `post-${i}`,
        contentId: c.id,
        platform: "instagram",
        measuredAt: "2026-11-25T00:00:00Z",
        views: 100 * (i + 1),
        likes: 10,
        comments: 1,
        shares: 2,
      },
    ]);
    const feedback = campaignFeedback(snapshots, contents);
    expect(feedback.insight.sample_size).toBe(5);
    expect(feedback.insight.topContent[0]?.views).toBe(500);
    expect(feedback.recommendations[0]?.sourceContentId).toBe("content-4");
  });
  it("rejects mislabeled or duration-mismatched MP4 at the three-lane quality gate", () => {
    expect(qualityCheckBundle(assets, "Narasi", ["Foto", "Carousel", "Video"], 7).passed).toBe(
      false,
    );
  });
});

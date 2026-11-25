import { afterEach, describe, expect, it, vi } from "vitest";
import { researchCampaign } from "./factory-research.server";

afterEach(() => vi.restoreAllMocks());
describe("Campaign research source contracts", () => {
  it("keeps a discussion source with no external URL and records its real publication date", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        hits: [
          {
            title: "AI automation",
            objectID: "420",
            created_at: "2025-01-01T00:00:00Z",
            points: 3,
            num_comments: 2,
          },
        ],
      }),
    );
    const sources = await researchCampaign("AI automation", 1);
    expect(sources[0]?.url).toBe("https://news.ycombinator.com/item?id=420");
    expect(sources[0]?.publishedAt).toBe("2025-01-01T00:00:00Z");
  });
  it("blocks research with no evidence rather than fabricating sources", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ hits: [] }));
    await expect(researchCampaign("AI automation", 1)).rejects.toThrow();
  });
});

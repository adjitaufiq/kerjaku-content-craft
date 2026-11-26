import { describe, expect, it } from "vitest";
import { buildFactoryResults, type ResultMedia } from "./factory-results";

const task = {
  id: "task-1",
  campaign_id: "campaign-1",
  ordinal: 1,
  stage: "render",
  state: "running",
  output: {},
};
function media(path: string, taskId = "task-1"): ResultMedia {
  return {
    id: path,
    task_id: taskId,
    campaign_id: "campaign-1",
    kind: "image",
    bucket: "private",
    path,
    mime: "image/png",
    bytes: 100,
    checksum: "a".repeat(64),
    duration: null,
    created_at: "2026-11-26T00:00:00Z",
  };
}
describe("Factory result handoff", () => {
  it("shows finalized poster and ordered slides, not intermediate scene images", () => {
    const result = buildFactoryResults(
      [task],
      [
        media("/scene-01.png"),
        media("/carousel-02.png"),
        media("/poster.jpg"),
        media("/carousel-01.png"),
      ],
      [],
      [],
    )[0];
    expect(result?.formats.poster.map((m) => m.path)).toEqual(["/poster.jpg"]);
    expect(result?.formats.carousel.map((m) => m.path)).toEqual([
      "/carousel-01.png",
      "/carousel-02.png",
    ]);
  });
  it("does not label unreviewed files ready", () => {
    expect(buildFactoryResults([task], [media("/poster.jpg")], [], [])[0]?.status).toBe("review");
  });
  it("labels checked output ready only when a final file exists", () => {
    const checked = { ...task, output: { qc: { passed: true, issues: [] } } };
    expect(buildFactoryResults([checked], [media("/poster.jpg")], [], [])[0]?.status).toBe("ready");
    expect(buildFactoryResults([checked], [], [], [])[0]?.status).toBe("processing");
  });
  it("holds unknown provider outcomes instead of suggesting automatic replay", () => {
    expect(
      buildFactoryResults(
        [{ ...task, state: "reconciliation_required" }],
        [media("/poster.jpg")],
        [],
        [],
      )[0]?.status,
    ).toBe("blocked");
  });
  it("never mixes output from a different task", () => {
    expect(
      buildFactoryResults([task], [media("/poster.jpg", "other-task")], [], [])[0]?.formats.poster,
    ).toEqual([]);
  });
});

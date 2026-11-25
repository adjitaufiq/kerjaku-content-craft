import { describe, expect, it } from "vitest";
import { parseTimestamp, validateReport, type SourceReport } from "./video-understanding.server";
import { normalizeStoryboard, type StoryboardResult } from "./video-storyboard.server";
import { VIDEO_DURATIONS } from "./photo-to-video.types";

describe("Existing engine regressions — deterministic logic, not media generation", () => {
  it("preserves the existing allowed scene durations", () => {
    expect(VIDEO_DURATIONS).toEqual([4, 6, 8, 10]);
  });
  it("preserves source timestamp parsing", () => {
    expect(parseTimestamp("01:23")).toBe(83);
    expect(parseTimestamp("00:01:23")).toBe(83);
    expect(parseTimestamp("invalid")).toBeNull();
  });
  it("rejects a fabricated source quote while accepting literal transcript evidence", () => {
    const empty = { value: "Tidak ditemukan pada sumber", evidence: [] };
    const makeReport = (quote: string): SourceReport => ({
      summary: {
        value: "Demo aplikasi",
        evidence: [{ source_type: "transcript", timestamp: "00:00", quote }],
      },
      topic: empty,
      category: empty,
      problem: empty,
      solution: empty,
      benefit_viewer: empty,
      main_information: [],
      tools_products: [],
      steps_framework: [],
    });
    const material = {
      transcript: [{ timestamp: "00:00", text: "Aplikasi membantu membuat laporan" }],
      onScreenText: [],
      scenes: [],
    };
    expect(
      validateReport(makeReport("Aplikasi membantu membuat laporan"), material).report.summary
        .verified,
    ).toBe(true);
    expect(
      validateReport(makeReport("Dijamin omzet naik sepuluh kali"), material).report.summary
        .verified,
    ).toBe(false);
  });
  it("keeps storyboard ordering and actual duration totals", () => {
    const scene = {
      scene_role: "demo",
      source_slide_number: 1,
      narrative: "demo",
      camera_movement: "pan",
      subject_motion: "demo",
      background_motion: "none",
      transition_in: "cut",
      transition_out: "cut",
      audio_direction: "voice",
      on_screen_text: "demo",
      video_prompt: "demo",
      negative_prompt: "none",
      consistency_lock: "same",
    };
    const storyboard: StoryboardResult = {
      video_concept: {
        title: "Demo",
        story_arc: "problem solution",
        visual_identity: "product",
        character_lock: "same",
        brand_lock: "same",
        aspect_ratio: "9:16",
        pacing: "steady",
      },
      scenes: [
        { ...scene, scene_number: 2, duration_seconds: 6 },
        { ...scene, scene_number: 1, duration_seconds: 4 },
      ],
      video_package: {
        scene_order: [2, 1],
        total_duration: 99,
        merge_notes: "cut",
        music_direction: "none",
        caption_overlay_plan: "none",
      },
    };
    const result = normalizeStoryboard(storyboard);
    expect(result.scenes.map((item) => item.duration_seconds)).toEqual([4, 6]);
    expect(result.video_package.total_duration).toBe(10);
    expect(result.video_package.scene_order).toEqual([1, 2]);
  });
});

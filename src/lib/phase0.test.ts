import { describe, expect, it, vi } from "vitest";
import { selectModel, runWithSafeFallback, type AiFailure } from "./ai-routing";
import { structuredValidator } from "./ai-output";
import { estimatedTokenCost, routerCatalogModel } from "./ai-catalog";
import { ownedAssetPath, parseAssetReference, assertOwnedPrefix } from "./asset-reference";
import {
  retryDelaySeconds,
  recoverLease,
  canSubmitPublish,
  schedulerIsVerified,
  PUBLISH_MAX_ATTEMPTS,
} from "./publishing-policy";
import { executeClaimedPublish } from "./publishing-executor";
import { requireCraftAdmin } from "./authorization";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
describe("Phase 0 policy tests — local, not production integration", () => {
  it("routes script work to a fast model and quality review to reasoning", () => {
    expect(selectModel("SCRIPT_GENERATION")).toBe("openai/gpt-5.4-mini");
    expect(selectModel("QUALITY_JUDGE")).toBe("openai/gpt-6-astra");
  });
  it("rejects an unverified model override", () => {
    expect(() => selectModel("VIDEO_UNDERSTANDING", "unverified/video")).toThrow();
  });
  it("uses the fallback provider only when generation demonstrably never started", async () => {
    const failure: AiFailure = {
      code: "request_rejected",
      outcome: "not_started",
      httpStatus: 503,
    };
    const calls: string[] = [];
    const result = await runWithSafeFallback(
      "openai/gpt-6-astra",
      "anthropic/claude-haiku-4-5",
      async (model) => {
        calls.push(model);
        if (calls.length === 1) throw failure;
        return "valid";
      },
      (error) => (error === failure ? failure : null),
    );
    expect(result).toBe("valid");
    expect(calls).toEqual(["openai/gpt-6-astra", "anthropic/claude-haiku-4-5"]);
  });
  it.each(["network_error", "timeout", "rate_limited", "payment_required", "permission_denied"])(
    "never replays %s",
    async (code) => {
      const failure: AiFailure = { code, outcome: "unknown", httpStatus: 503 };
      const run = vi.fn().mockRejectedValue(failure);
      await expect(
        runWithSafeFallback("openai/gpt-6-astra", "anthropic/claude-haiku-4-5", run, () => failure),
      ).rejects.toEqual(failure);
      expect(run).toHaveBeenCalledTimes(1);
    },
  );
  it("validates structured output instead of coercing malformed model fields", () => {
    const validate = structuredValidator<{ scene: number }>({
      type: "object",
      additionalProperties: false,
      required: ["scene"],
      properties: { scene: { type: "integer", enum: [4, 6, 8, 10] } },
    });
    expect(validate({ scene: 6 })).toBe(true);
    expect(validate({ scene: 5 })).toBe(false);
    expect(validate({ scene: "6" })).toBe(false);
  });
  it("tracks estimated credits from verified catalog rates, not a fabricated USD price", () => {
    const model = routerCatalogModel.parse({
      id: "sample",
      owned_by: "sample",
      supported_surfaces: ["responses"],
      modalities: { input: ["text"] },
      pricing: {
        cost_currency: "credits",
        input: { text: { tiers: [{ min: 0, cost: "0.000004" }] } },
        output: { text: { tiers: [{ min: 0, cost: "0.00002" }] } },
      },
    });
    expect(estimatedTokenCost(model, 1000, 500)).toBeCloseTo(0.014);
    expect(estimatedTokenCost(model, null, 500)).toBeNull();
  });
  it("puts user identity first in asset paths and denies user B's path", () => {
    expect(ownedAssetPath(A, "content-1", "photo.jpg")).toBe(`${A}/content-1/photo.jpg`);
    expect(() => assertOwnedPrefix(`${B}/photo.jpg`, A)).toThrow();
    expect(() => ownedAssetPath(A, "../escape", "photo.jpg")).toThrow();
  });
  it("extracts a durable object reference without trusting an expired signature or external host", () => {
    expect(
      parseAssetReference(
        `https://storage.example/storage/v1/object/sign/instagram-media/${A}/photo.jpg?token=expired`,
        "https://storage.example",
        "instagram-media",
      ),
    ).toBe(`${A}/photo.jpg`);
    expect(() =>
      parseAssetReference(
        `https://attacker.example/storage/v1/object/sign/instagram-media/${A}/photo.jpg`,
        "https://storage.example",
        "instagram-media",
      ),
    ).toThrow();
  });
  it("uses bounded exponential retries and a finite maximum", () => {
    expect([1, 2, 3, 4, 5].map(retryDelaySeconds)).toEqual([30, 60, 120, 240, 480]);
    expect(retryDelaySeconds(30)).toBe(900);
    expect(PUBLISH_MAX_ATTEMPTS).toBe(5);
  });
  it("does not send an expired in-flight publish back to pending", () => {
    expect(recoverLease("publishing")).toBe("reconciliation_required");
    expect(recoverLease("creating_container")).toBe("pending");
  });
  it("requires verified server availability before scheduler cutover", () => {
    expect(
      schedulerIsVerified({ server_scheduler_enabled: true, scheduler_verified_at: null }),
    ).toBe(false);
    expect(
      schedulerIsVerified({
        server_scheduler_enabled: false,
        scheduler_verified_at: "2026-11-25T00:00:00Z",
      }),
    ).toBe(false);
    expect(
      schedulerIsVerified({
        server_scheduler_enabled: true,
        scheduler_verified_at: "2026-11-25T00:00:00Z",
      }),
    ).toBe(true);
  });
  it("requires a ready container and no existing platform post ID", () => {
    expect(canSubmitPublish("container_ready", "container-1", null)).toBe(true);
    expect(canSubmitPublish("container_ready", "container-1", "post-1")).toBe(false);
  });
  it("refuses publishing privileges when role verification fails", async () => {
    const denied = {
      rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
    } as unknown as SupabaseClient<Database>;
    await expect(requireCraftAdmin(denied, A)).rejects.toThrow("Forbidden");
  });
});

describe("Durable publishing executor — simulated transport, not public posting", () => {
  it("persists submission state BEFORE the platform side effect", async () => {
    const events: string[] = [];
    const result = await executeClaimedPublish(
      { id: "job", state: "leased", creation_id: null, platform_post_id: null },
      {
        persist: async (state) => {
          events.push(state);
        },
      },
      {
        create: async () => "container",
        status: async () => "FINISHED",
        submit: async () => {
          events.push("platform_submit");
          return "post";
        },
      },
    );
    expect(result).toBe("post");
    expect(events).toEqual([
      "creating_container",
      "container_ready",
      "publishing",
      "platform_submit",
      "succeeded",
    ]);
  });
  it("does not duplicate a post when the connection fails after platform acceptance", async () => {
    let persistedState = "leased";
    const submit = vi.fn().mockRejectedValue(new Error("connection lost after acceptance"));
    const store = {
      persist: async (state: string) => {
        persistedState = state;
      },
    };
    const transport = { create: async () => "container", status: async () => "FINISHED", submit };
    await expect(
      executeClaimedPublish(
        { id: "job", state: "leased", creation_id: null, platform_post_id: null },
        store,
        transport,
      ),
    ).rejects.toThrow();
    expect(persistedState).toBe("reconciliation_required");
    await executeClaimedPublish(
      { id: "job", state: persistedState, creation_id: "container", platform_post_id: null },
      store,
      transport,
    );
    expect(submit).toHaveBeenCalledTimes(1);
  });
  it("reconciles an already recorded post ID without making another platform request", async () => {
    const submit = vi.fn();
    expect(
      await executeClaimedPublish(
        { id: "job", state: "succeeded", creation_id: "container", platform_post_id: "post" },
        { persist: async () => {} },
        { create: vi.fn(), status: vi.fn(), submit },
      ),
    ).toBe("post");
    expect(submit).not.toHaveBeenCalled();
  });
  it("stops before publication if durable storage cannot record the publishing stage", async () => {
    const submit = vi.fn();
    await expect(
      executeClaimedPublish(
        { id: "job", state: "container_ready", creation_id: "container", platform_post_id: null },
        {
          persist: async () => {
            throw new Error("lease lost");
          },
        },
        { create: vi.fn(), status: async () => "FINISHED", submit },
      ),
    ).rejects.toThrow("lease lost");
    expect(submit).not.toHaveBeenCalled();
  });
});

import { GatewayError } from "@lovable.dev/ai-gateway";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { factoryClient } from "./factory-db";
import { phase0Client } from "./phase0-db";
import { campaignSchema, type FactoryAsset, type FactoryTask, type TaskOutput } from "./factory-types";
import { contentSchema } from "./content-bank";
import { nextFactoryStage, qualityCheck } from "./factory-policy";
import { researchCampaign } from "./factory-research.server";
import { generateCampaignScript } from "./factory-script.server";
import { generateCampaignImages } from "./factory-image.server";

export const workerInput = z.object({ action: z.enum(["claim", "complete", "fail"]), worker: z.string().min(8).max(100),
  taskId: z.string().uuid().optional(), error: z.string().max(1000).optional(),
  assets: z.array(z.object({ kind: z.enum(["voice", "video", "subtitle"]), path: z.string(), mime: z.string(), bytes: z.number().int().positive(), checksum: z.string().regex(/^[a-f0-9]{64}$/), duration: z.number().positive().nullable() })).max(5).optional(),
});
const NATIVE_FILES: Record<string, { filename: string; kind: FactoryAsset["kind"]; mime: string }[]> = {
  voice: [{ filename: "voice.mp3", kind: "voice", mime: "audio/mpeg" }, { filename: "subtitles.srt", kind: "subtitle", mime: "application/x-subrip" }, { filename: "subtitles.vtt", kind: "subtitle", mime: "text/vtt" }],
  render: [{ filename: "video.mp4", kind: "video", mime: "video/mp4" }],
};
export async function executeFactoryWorker(admin: SupabaseClient<Database>, input: z.infer<typeof workerInput>, publicStorageOrigin: string) {
  const db = factoryClient(admin);
  if (input.action !== "claim") {
    if (!input.taskId) throw new Error("Task required");
    const { data: task, error } = await db.from("craft_tasks").select("*").eq("id", input.taskId).eq("state", "running").eq("lease_owner", input.worker).gt("lease_until", new Date().toISOString()).single();
    if (error || !task) throw new Error("LEASE_LOST");
    if (input.action === "fail") {
      await db.from("craft_tasks").update({ state: "blocked", error: input.error ?? "Native worker failed", lease_owner: null, lease_until: null }).eq("id", task.id).eq("lease_owner", input.worker);
      return { completed: false, blocked: true };
    }
    const expected = NATIVE_FILES[task.stage]; if (!expected || input.assets?.length !== expected.length) throw new Error("Invalid output count");
    const assets: FactoryAsset[] = [];
    for (const file of expected) {
      const path = `${task.user_id}/factory/${task.campaign_id}/${task.id}/${file.filename}`;
      const supplied = input.assets.find((a) => a.path === path && a.kind === file.kind && a.mime === file.mime);
      if (!supplied) throw new Error("Asset owner/path mismatch");
      // Verify bytes and checksum through storage read-back, not worker assertions alone.
      const { data: body, error: readError } = await admin.storage.from("instagram-media").download(path);
      if (readError || !body) throw new Error("Output not stored");
      const bytes = new Uint8Array(await body.arrayBuffer());
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map((v) => v.toString(16).padStart(2, "0")).join("");
      if (bytes.length !== supplied.bytes || hash !== supplied.checksum) throw new Error("Output checksum mismatch");
      const asset: FactoryAsset = { ...supplied, bucket: "instagram-media" };
      const { error: saveError } = await db.from("craft_media").upsert({ ...asset, user_id: task.user_id, task_id: task.id, campaign_id: task.campaign_id }, { onConflict: "bucket,path" });
      if (saveError) throw new Error("Library write failed"); assets.push(asset);
    }
    const output = task.output as TaskOutput;
    const { data: ok, error: completionError } = await db.rpc("craft_complete_task", { task_id: task.id, worker: input.worker, result: { ...output, assets: [...(output.assets ?? []), ...assets] }, next_stage: nextFactoryStage(task.stage) });
    if (completionError || !ok) throw new Error("LEASE_LOST");
    return { completed: true };
  }
  const { data: tasks, error: claimError } = await db.rpc("craft_claim_task", { worker: input.worker });
  if (claimError) throw new Error("Factory queue unavailable");
  const task = tasks?.[0]; if (!task) return { idle: true };
  const output = task.output as TaskOutput;
  try {
    const { data: campaign, error } = await db.from("craft_campaigns").select("config").eq("id", task.campaign_id).eq("user_id", task.user_id).single();
    if (error || !campaign) throw new Error("Campaign owner mismatch");
    const config = campaignSchema.parse(campaign.config);
    if (["script", "image"].includes(task.stage)) {
      const { data: health, error: healthError } = await phase0Client(admin).from("craft_runtime_health").select("ai_pause_reason,ai_paused_until").eq("id", "default").single();
      if (healthError || !health) throw new Error("AI runtime unavailable");
      if (health.ai_pause_reason && (!health.ai_paused_until || Date.parse(health.ai_paused_until) > Date.now())) throw new Error("AI production paused");
    }
    let result: TaskOutput = output;
    if (task.stage === "research") result = { ...output, sources: await researchCampaign(config.command, task.ordinal) };
    else if (task.stage === "script") {
      if (!output.sources?.length) throw new Error("Research sources missing");
      const content = await generateCampaignScript(config, output.sources, task.ordinal, task.id, input.worker);
      const { data: stored, error: saveError } = await db.rpc("craft_store_generated", { task_id: task.id, worker: input.worker, document: content });
      if (saveError) throw new Error("Generated script not stored");
      result = { ...output, content: contentSchema.parse(stored) };
    } else if (task.stage === "image") {
      if (!output.content) throw new Error("Script missing");
      result = { ...output, assets: [...(output.assets ?? []), ...await generateCampaignImages(admin, task, output.content, config.slides)] };
    } else if (task.stage === "voice" || task.stage === "render") {
      if (!output.content) throw new Error("Production script missing");
      const uploads = [];
      for (const file of NATIVE_FILES[task.stage] ?? []) {
        const path = `${task.user_id}/factory/${task.campaign_id}/${task.id}/${file.filename}`;
        const { data: signed, error: signError } = await admin.storage.from("instagram-media").createSignedUploadUrl(path);
        if (signError || !signed) throw new Error("Upload ticket unavailable");
        const u = new URL(signed.signedUrl); uploads.push({ ...file, path, url: `${new URL(publicStorageOrigin).origin}${u.pathname}${u.search}` });
      }
      const inputs = [];
      for (const asset of output.assets ?? []) {
        const { data: signed, error: signError } = await admin.storage.from(asset.bucket).createSignedUrl(asset.path, 3600);
        if (signError || !signed) throw new Error("Media unavailable");
        const u = new URL(signed.signedUrl); inputs.push({ ...asset, url: `${new URL(publicStorageOrigin).origin}${u.pathname}${u.search}` });
      }
      return { task: { id: task.id, stage: task.stage, content: output.content, inputs, uploads }, idle: false };
    } else if (task.stage === "quality") {
      const qc = qualityCheck(output.assets ?? [], output.content?.production.voiceOver ?? "");
      if (!qc.passed) throw new Error(qc.issues.join("; "));
      result = { ...output, qc };
    } else if (task.stage === "distribution") {
      // No platform account/policy is assumed. Finished media remains in the library for export.
      throw new Error("Media siap; publikasi menunggu akun platform, kebijakan autopublish dan scheduler terverifikasi.");
    } else throw new Error("Analytics awaits a verified publication ID");
    const { data: complete, error: completeError } = await db.rpc("craft_complete_task", { task_id: task.id, worker: input.worker, result, next_stage: nextFactoryStage(task.stage) });
    if (completeError || !complete) throw new Error("LEASE_LOST");
    return { completed: true, taskId: task.id, stage: task.stage };
  } catch (error) {
    const ambiguous = error instanceof GatewayError && error.outcome === "unknown";
    const message = error instanceof GatewayError ? `AI ${error.code}: ${error.message}` : error instanceof Error ? error.message : "Factory failed";
    const { error: saveError } = await db.from("craft_tasks").update({ state: ambiguous ? "reconciliation_required" : "blocked", error: message, lease_owner: null, lease_until: null }).eq("id", task.id).eq("lease_owner", input.worker);
    if (saveError) throw new Error("Job result unknown; do not replay");
    if (error instanceof GatewayError && ["payment_required", "permission_denied", "rate_limited"].includes(error.code)) {
      await phase0Client(admin).from("craft_runtime_health").update({ ai_pause_reason: error.code, ai_paused_until: error.code === "rate_limited" ? new Date(Date.now() + (error.retryAfter ?? 60) * 1000).toISOString() : null }).eq("id", "default");
    }
    return { completed: false, blocked: true, error: message };
  }
}
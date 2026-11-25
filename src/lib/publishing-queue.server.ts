import { phase0Client } from "./phase0-db";
import { executeClaimedPublish } from "./publishing-executor";
import { PUBLISH_LEASE_SECONDS, retryDelaySeconds } from "./publishing-policy";
import { createMediaContainer, getContainerStatus, graphPost, PublishingError } from "./instagram-graph.server";
import { parseAssetReference } from "./asset-reference";

export async function runPublishingQueue(onlyJobId: string | null = null) {
  // Callers must verify cron credentials OR an administrator plus ownership before entering.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = phase0Client(supabaseAdmin);
  const workerId = crypto.randomUUID();
  const { error: heartbeatError } = await db.from("craft_runtime_health").update({ last_heartbeat_at: new Date().toISOString() }).eq("id", "default");
  if (heartbeatError) throw new Error("Scheduler schema/database unavailable");
  const { data: setting, error: settingError } = await db.from("craft_runtime_health").select("server_scheduler_enabled, scheduler_verified_at").eq("id", "default").single();
  if (settingError) throw new Error("Scheduler settings unavailable");
  if (!onlyJobId && (!setting.server_scheduler_enabled || !setting.scheduler_verified_at)) return { paused: true, claimed: 0, published: 0 };
  const { error: recoveryError } = await db.rpc("recover_publish_jobs", {});
  if (recoveryError) throw new Error("Stale job recovery failed");
  const { data: jobs, error } = await db.rpc("claim_publish_job", { worker_id: workerId, lease_seconds: PUBLISH_LEASE_SECONDS, only_job_id: onlyJobId });
  if (error) throw new Error("Atomic claim failed");
  let published = 0;
  for (const job of jobs) {
    let currentState = job.state;
    const persist = async (state: string, patch: { creation_id?: string; platform_post_id?: string } = {}) => {
      const terminal = ["succeeded", "reconciliation_required"].includes(state);
      const { data: saved, error: saveError } = await db.from("publishing_jobs").update({ state, ...patch, updated_at: new Date().toISOString(), ...(terminal ? { lease_owner: null, lease_until: null } : {}) }).eq("id", job.id).eq("lease_owner", workerId).gt("lease_until", new Date().toISOString()).select("id");
      if (saveError || !saved?.length) throw new Error("LEASE_LOST");
      currentState = state;
    };
    try {
      const { requirePublishCredentials } = await import("./meta-token.server");
      const { token, igAccountId } = await requirePublishCredentials();
      // Admin delivery is scoped to a previously claimed owned content row; never accept arbitrary caller paths.
      const { data: content, error: contentError } = await supabaseAdmin.from("content_logs").select("*").eq("id", job.content_log_id).single();
      if (contentError || !content || (content as unknown as { user_id: string }).user_id !== job.user_id) throw new Error("ASSET_OWNER_MISMATCH");
      const origin = process.env["VITE_SUPABASE_URL"];
      if (!origin) throw new Error("STORAGE_UNAVAILABLE");
      const urls: string[] = [];
      for (const ref of job.image_refs) {
        const path = parseAssetReference(ref, origin, "instagram-media");
        const { data: objects, error: objectError } = await supabaseAdmin.storage.from("instagram-media").list(path.slice(0, path.lastIndexOf("/")), { search: path.split("/").at(-1) ?? "" });
        // Legacy assets must have an explicit reviewed manifest; new ones have an owner prefix.
        if (objectError || !objects?.length) throw new Error("ASSET_MISSING");
        if (!path.startsWith(`${job.user_id}/`)) {
          const { data: legacy, error: manifestError } = await db.rpc("phase0_asset_owner", { bucket_name: "instagram-media", object_path: path });
          if (manifestError || legacy !== job.user_id) throw new Error("ASSET_OWNER_MISMATCH");
        }
        const { data: signed, error: signedError } = await supabaseAdmin.storage.from("instagram-media").createSignedUrl(path, 3600);
        if (signedError || !signed?.signedUrl) throw new Error("ASSET_SIGN_FAILED");
        const url = new URL(signed.signedUrl);
        urls.push(`${new URL(origin).origin}${url.pathname}${url.search}`);
      }
      const postId = await executeClaimedPublish(job, { persist }, {
        create: () => createMediaContainer({ token, igAccountId, imageUrls: urls, caption: job.caption }),
        status: (id) => getContainerStatus(id, token),
        submit: (id) => graphPost(`${igAccountId}/media_publish`, { creation_id: id, access_token: token }),
      });
      if (postId) {
        const { error: logError } = await supabaseAdmin.from("content_logs").update({ status: "published", ig_post_id: postId, error_message: null }).eq("id", job.content_log_id);
        if (logError) throw new Error("CONTENT_LOG_RECONCILE_FAILED");
        published += 1;
        await db.from("craft_runtime_health").update({ last_success_at: new Date().toISOString() }).eq("id", "default");
      }
    } catch (error) {
      const ambiguous = currentState === "publishing" || currentState === "reconciliation_required" || currentState === "succeeded";
      const retryable = !ambiguous && (error instanceof PublishingError ? error.retryable || error.code === "unknown" : error instanceof Error && error.message === "CONTAINER_PROCESSING");
      const state = ambiguous ? "reconciliation_required" : retryable && job.attempt < job.max_attempts ? "pending" : "failed";
      const code = error instanceof PublishingError ? error.code : error instanceof Error ? error.message : "unknown";
      await db.from("publishing_jobs").update({ state, available_at: new Date(Date.now() + retryDelaySeconds(job.attempt) * 1000).toISOString(), lease_owner: null, lease_until: null, last_error: { code, stage: currentState } }).eq("id", job.id).eq("lease_owner", workerId);
      await supabaseAdmin.from("content_logs").update({ status: state === "pending" ? "scheduled" : "failed", error_message: ambiguous ? "Publikasi perlu rekonsiliasi; tidak akan diposting ulang otomatis." : `Publikasi gagal: ${code}` }).eq("id", job.content_log_id);
      console.error(JSON.stringify({ event: "publish_job_failure", job_id: job.id, attempt: job.attempt, state, code }));
      if (error instanceof PublishingError && error.code === "auth") break;
    }
  }
  return { claimed: jobs.length, published, paused: false };
}
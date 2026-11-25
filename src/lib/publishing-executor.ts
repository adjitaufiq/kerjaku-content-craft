import { canSubmitPublish } from "./publishing-policy";
export type PublishExecution = { id: string; state: string; creation_id: string | null; platform_post_id: string | null };
export type PublishExecutionStore = {
  persist: (state: string, patch?: { creation_id?: string; platform_post_id?: string }) => Promise<void>;
};
export type PublishTransport = { create: () => Promise<string>; status: (id: string) => Promise<string>; submit: (id: string) => Promise<string> };
/** Persistence precedes every irreversible side effect. Unknown submission is never replayed. */
export async function executeClaimedPublish(job: PublishExecution, store: PublishExecutionStore, transport: PublishTransport) {
  if (job.platform_post_id) {
    await store.persist("succeeded", { platform_post_id: job.platform_post_id });
    return job.platform_post_id;
  }
  if (job.state === "reconciliation_required" || job.state === "publishing") {
    if (job.creation_id) await transport.status(job.creation_id);
    await store.persist("reconciliation_required");
    return null;
  }
  let creationId = job.creation_id;
  if (!creationId) {
    await store.persist("creating_container");
    creationId = await transport.create();
    await store.persist("container_ready", { creation_id: creationId });
  }
  const status = await transport.status(creationId);
  if (status === "PUBLISHED") { await store.persist("reconciliation_required"); return null; }
  if (status !== "FINISHED") throw new Error(status === "IN_PROGRESS" ? "CONTAINER_PROCESSING" : "CONTAINER_REJECTED");
  if (!canSubmitPublish("container_ready", creationId, job.platform_post_id)) throw new Error("INVALID_PUBLISH_STATE");
  await store.persist("publishing", { creation_id: creationId });
  let postId: string;
  try { postId = await transport.submit(creationId); }
  catch (error) {
    // Even an apparently transient error can arrive after the platform accepted the post.
    await store.persist("reconciliation_required", { creation_id: creationId });
    throw error;
  }
  await store.persist("succeeded", { platform_post_id: postId });
  return postId;
}
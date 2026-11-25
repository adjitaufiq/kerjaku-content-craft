export const PUBLISH_MAX_ATTEMPTS = 5;
export const PUBLISH_LEASE_SECONDS = 180;
export function retryDelaySeconds(attempt: number): number {
  return Math.min(900, 30 * 2 ** Math.max(0, attempt - 1));
}
export function recoverLease(state: string): "pending" | "reconciliation_required" {
  return state === "publishing" || state === "reconciliation_required"
    ? "reconciliation_required"
    : "pending";
}
export function canSubmitPublish(state: string, creationId: string | null, postId: string | null) {
  return state === "container_ready" && Boolean(creationId) && !postId;
}
export function schedulerIsVerified(input: {
  server_scheduler_enabled: boolean;
  scheduler_verified_at: string | null;
}) {
  // Do not revert to browser execution on a late heartbeat: it could duplicate a server operation.
  return input.server_scheduler_enabled && Boolean(input.scheduler_verified_at);
}

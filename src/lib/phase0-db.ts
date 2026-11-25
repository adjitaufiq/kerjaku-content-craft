import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };
export type PublishingJob = {
  id: string; user_id: string; content_log_id: string; idempotency_key: string;
  state: string; attempt: number; max_attempts: number; available_at: string;
  lease_owner: string | null; lease_until: string | null;
  creation_id: string | null; platform_post_id: string | null; last_error: Json;
  image_refs: string[]; caption: string; created_at: string; updated_at: string;
};
export type RuntimeHealth = {
  id: string; server_scheduler_enabled: boolean; scheduler_verified_at: string | null;
  last_heartbeat_at: string | null; last_success_at: string | null;
  worker_heartbeat_at: string | null; ai_paused_until: string | null; ai_pause_reason: string | null;
};
type Rpc<Args, Returns> = { Args: Args; Returns: Returns };
export type Phase0Database = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables" | "Functions"> & {
    Tables: Database["public"]["Tables"] & {
      publishing_jobs: Table<PublishingJob>;
      craft_runtime_health: Table<RuntimeHealth>;
      ai_usage_events: Table<{
        id: string; user_id: string; capability: string; model: string; provider: string;
        state: string; input_tokens: number | null; output_tokens: number | null;
        estimated_cost_credits: number | null; error_code: string | null; created_at: string;
      }>;
    };
    Functions: Database["public"]["Functions"] & {
      claim_publish_job: Rpc<{ worker_id: string; lease_seconds: number; only_job_id: string | null }, PublishingJob[]>;
      enqueue_publish_job: Rpc<{ log_id: string }, string>;
      recover_publish_jobs: Rpc<Record<string, never>, number>;
      phase0_asset_owner: Rpc<{ bucket_name: string; object_path: string }, string | null>;
    };
  };
};
// Pending-migration types stay separate from the integration-managed generated file.
export function phase0Client(client: SupabaseClient<Database>): SupabaseClient<Phase0Database> {
  return client as unknown as SupabaseClient<Phase0Database>;
}
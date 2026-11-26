import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { FactoryTask, FactoryBankRow, FactoryCampaign, DistributionPackage } from "./factory-types";
export type DistributionRow = {
  id: string; user_id: string; task_id: string; campaign_id: string; content_id: string; platform: string; format: string;
  package: DistributionPackage; state: string; reason: string | null; available_at: string | null;
  lease_owner: string | null; lease_until: string | null; submission_id: string | null; platform_post_id: string | null;
  post_url: string | null; attempt: number; last_error: string | null; authorized_at: string | null; created_at: string; updated_at: string;
};
type Table<T> = { Row: T; Insert: Partial<T>; Update: Partial<T>; Relationships: [] };
export type FactoryDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables" | "Functions"> & {
    Tables: Database["public"]["Tables"] & {
      craft_bank: Table<FactoryBankRow>;
      craft_campaigns: Table<Omit<FactoryCampaign, "tasks">>;
      craft_tasks: Table<FactoryTask & { available_at: string; created_at: string }>;
      craft_distribution: Table<DistributionRow>;
      craft_metric_snapshots: Table<{ id: string; user_id: string; distribution_id: string; content_id: string; platform: string; platform_post_id: string; views: number | null; likes: number | null; comments: number | null; shares: number | null; measured_at: string }>;
      craft_media: Table<{
        id: string;
        user_id: string;
        task_id: string;
        campaign_id: string;
        kind: string;
        bucket: string;
        path: string;
        mime: string;
        bytes: number;
        checksum: string;
        duration: number | null;
        created_at: string;
      }>;
    };
    Functions: Database["public"]["Functions"] & {
      craft_create_campaign: {
        Args: { command_text: string; campaign_config: unknown; item_count: number };
        Returns: string;
      };
      craft_claim_task: { Args: { worker: string }; Returns: FactoryTask[] };
      craft_renew_lease: { Args: { task_id: string; worker: string }; Returns: string | null };
      craft_claim_distribution: { Args: { worker: string }; Returns: DistributionRow[] };
      craft_enqueue_distribution: { Args: { task_id: string; worker: string; packages: unknown }; Returns: number };
      craft_complete_task: {
        Args: { task_id: string; worker: string; result: unknown; next_stage: string };
        Returns: boolean;
      };
      craft_save_bank: { Args: { documents: unknown }; Returns: number };
      craft_store_generated: {
        Args: { task_id: string; worker: string; document: unknown };
        Returns: unknown;
      };
    };
  };
};
export function factoryClient(client: SupabaseClient<Database>): SupabaseClient<FactoryDatabase> {
  return client as unknown as SupabaseClient<FactoryDatabase>;
}

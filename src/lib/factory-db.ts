import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { FactoryTask, FactoryBankRow, FactoryCampaign } from "./factory-types";
type Table<T> = { Row: T; Insert: Partial<T>; Update: Partial<T>; Relationships: [] };
export type FactoryDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables" | "Functions"> & {
    Tables: Database["public"]["Tables"] & {
      craft_bank: Table<FactoryBankRow>;
      craft_campaigns: Table<Omit<FactoryCampaign, "tasks">>;
      craft_tasks: Table<FactoryTask & { available_at: string; created_at: string }>;
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

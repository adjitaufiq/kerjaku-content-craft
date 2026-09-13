import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AtmMode } from "@/lib/cliper-intelligence.functions";
import type { Json } from "@/integrations/supabase/types";
import type { ApprovalStatus } from "@/lib/quality.functions";

export type LibraryItem = {
  id: string;
  version_id: string;
  source_id: string | null;
  title: string;
  category: string | null;
  atm_mode: AtmMode;
  hook_type: string;
  approval_status: ApprovalStatus;
  override_note: string;
  quality_result: {
    overall_score?: number;
    status?: string;
    source_fidelity?: number;
    brand_safety?: number;
  };
  viral_attributes: Json;
  content_assets: Json;
  source_data: Json;
  published_at: string | null;
  created_at: string;
  performance: {
    period: "24h" | "7d" | "30d";
    views: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    engagement_rate: number;
  }[];
};

export type LibraryFilters = {
  category?: string;
  hookType?: string;
  atmMode?: AtmMode | "all";
  performance?: "all" | "measured" | "unmeasured";
};

export const listContentLibrary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: LibraryFilters) => input)
  .handler(async ({ data, context }): Promise<LibraryItem[]> => {
    let query = context.supabase
      .from("content_library")
      .select("*")
      .order("created_at", { ascending: false });
    if (data.category) query = query.eq("category", data.category);
    if (data.hookType) query = query.eq("hook_type", data.hookType);
    if (data.atmMode && data.atmMode !== "all") query = query.eq("atm_mode", data.atmMode);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((row) => row.id);
    const { data: perf, error: perfError } = ids.length
      ? await context.supabase.from("content_performance").select("*").in("content_id", ids)
      : { data: [], error: null };
    if (perfError) throw new Error(perfError.message);

    const items = (rows ?? []).map((row) => ({
      ...(row as unknown as LibraryItem),
      performance: (perf ?? [])
        .filter((entry) => entry.content_id === row.id)
        .map((entry) => ({
          period: entry.measurement_period,
          views: entry.views,
          likes: entry.likes,
          comments: entry.comments,
          shares: entry.shares,
          saves: entry.saves,
          engagement_rate: Number(entry.engagement_rate),
        })),
    })) as LibraryItem[];

    if (data.performance === "measured") return items.filter((item) => item.performance.length > 0);
    if (data.performance === "unmeasured") return items.filter((item) => item.performance.length === 0);
    return items;
  });

export const getLibraryFacets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ categories: string[]; hookTypes: string[] }> => {
    const { data, error } = await context.supabase.from("content_library").select("category,hook_type");
    if (error) throw new Error(error.message);
    const categories = [...new Set((data ?? []).map((row) => row.category).filter(Boolean))] as string[];
    const hookTypes = [...new Set((data ?? []).map((row) => row.hook_type).filter(Boolean))];
    return { categories, hookTypes };
  });

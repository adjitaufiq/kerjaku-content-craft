import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCraftAdmin } from "./authorization";

import type { TokenStatus } from "@/lib/meta-token.server";

/** Returns expiry metadata only — never the token itself. */
export const getMetaTokenStatus = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(
  async ({ context }): Promise<TokenStatus> => {
    await requireCraftAdmin(context.supabase, context.userId);
    const { syncTokenMetadata } = await import("@/lib/meta-token.server");
    return syncTokenMetadata();
  },
);

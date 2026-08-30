import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AccessContext = {
  userId: string;
  email: string | null;
  isAdmin: boolean;
};

/**
 * Returns the caller's access context. Bootstrap rule: if no admin exists yet,
 * the first authenticated account is promoted to admin.
 */
export const getAccessContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccessContext> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = (context.claims['email'] as string | undefined) ?? null;

    const { data: admins } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (!admins?.length) {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: context.userId, role: "admin" }, { onConflict: "user_id,role" });
      return { userId: context.userId, email, isAdmin: true };
    }

    return {
      userId: context.userId,
      email,
      isAdmin: admins.some((r) => r.user_id === context.userId),
    };
  });

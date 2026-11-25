import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AccessContext = {
  userId: string;
  email: string | null;
  isAdmin: boolean;
};

/** Read roles only; sign-in must never grant administrative privileges. */
export const getAccessContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccessContext> => {
    const email = (context.claims['email'] as string | undefined) ?? null;
    const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (error) throw new Error("Hak akses belum dapat diverifikasi.");

    return {
      userId: context.userId,
      email,
      isAdmin: isAdmin === true,
    };
  });

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { TokenStatus } from "@/lib/meta-token.server";

export type IntegrationView = {
  isAdmin: boolean;
  status: TokenStatus;
};

type UpdateInput = {
  token: string;
  igAccountId: string;
  expectedVersion: number | null;
};

/** Admin-only integration view: metadata only, never the raw token. */
export const getIntegrationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<IntegrationView> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const { getCredentialStatus } = await import("@/lib/meta-token.server");
    const status = await getCredentialStatus();
    if (!isAdmin) {
      return {
        isAdmin: false,
        status: { ...status, tokenMask: null, tokenFingerprint: null, appId: null },
      };
    }
    return { isAdmin: true, status };
  });

/** Validates the pasted token against Meta, then stores it encrypted. */
export const updateMetaCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: UpdateInput) => {
    const token = input.token?.trim() ?? "";
    if (token.length < 40) throw new Error("Token tidak valid (terlalu pendek).");
    return {
      token,
      igAccountId: input.igAccountId?.trim() ?? "",
      expectedVersion: input.expectedVersion ?? null,
    };
  })
  .handler(async ({ data, context }): Promise<TokenStatus> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Hanya administrator yang boleh mengubah kredensial.");

    const { inspectToken, writeCredential, exchangeForLongLivedToken } = await import(
      "@/lib/meta-credentials.server"
    );
    const igAccountId = data.igAccountId || null;

    let token = data.token;
    let inspection = await inspectToken(token, igAccountId);
    if (!inspection.valid) throw new Error(inspection.error ?? "Token ditolak oleh Meta.");

    // Short-lived token (biasanya ~2 jam dari Graph API Explorer) ditukar dulu
    // ke long-lived (~60 hari) lewat endpoint resmi fb_exchange_token.
    if (inspection.shortLived) {
      const exchange = await exchangeForLongLivedToken(token);
      if (exchange.exchanged) {
        const reinspected = await inspectToken(exchange.token, igAccountId);
        if (reinspected.valid) {
          token = exchange.token;
          inspection = reinspected;
        }
      } else if (!process.env["META_APP_ID"] || !process.env["META_APP_SECRET"]) {
        throw new Error(
          "Token ini short-lived (berlaku beberapa jam). Tambahkan META_APP_ID dan META_APP_SECRET agar bisa ditukar otomatis ke token 60 hari.",
        );
      } else {
        throw new Error(`Token short-lived dan gagal ditukar: ${exchange.note}`);
      }
    }

    await writeCredential({
      token,
      igAccountId,
      inspection,
      userId: context.userId,
      expectedVersion: data.expectedVersion,
    });

    const { getCredentialStatus } = await import("@/lib/meta-token.server");
    return getCredentialStatus();
  });

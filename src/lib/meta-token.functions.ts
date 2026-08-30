import { createServerFn } from "@tanstack/react-start";

import type { TokenStatus } from "@/lib/meta-token.server";

/** Returns expiry metadata only — never the token itself. */
export const getMetaTokenStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<TokenStatus> => {
    const { syncTokenMetadata } = await import("@/lib/meta-token.server");
    return syncTokenMetadata();
  },
);

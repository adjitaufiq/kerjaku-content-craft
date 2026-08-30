/**
 * Server-only Meta/Instagram access token lifecycle management.
 *
 * The token lives ONLY in the server secret META_ACCESS_TOKEN. It is never
 * returned to the browser, never logged, and never stored in the database —
 * the database only keeps expiry metadata.
 */
const GRAPH = "https://graph.facebook.com/v19.0";

export const TOKEN_EXPIRED_MESSAGE =
  "Instagram access token expired. Please update the Meta access token.";

export const DEFAULT_LIFETIME_DAYS = 60;
const WARN_DAYS = 7;

export type TokenState = "missing" | "active" | "expiring_soon" | "expired";

export type TokenStatus = {
  state: TokenState;
  configured: boolean;
  tokenType: string;
  tokenCreatedAt: string | null;
  tokenExpiresAt: string | null;
  tokenLastUpdatedAt: string | null;
  daysRemaining: number | null;
  expiresInExact: boolean;
  igAccountConfigured: boolean;
  message: string;
};

function env(name: string) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : null;
}

async function fingerprint(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type MetaRow = {
  token_fingerprint: string;
  token_type: string;
  token_created_at: string;
  token_expires_at: string;
  token_last_updated_at: string;
  expires_in_exact: boolean;
};

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // meta_token_meta is not in the generated types yet.
  return supabaseAdmin as unknown as {
    from: (table: string) => any;
  };
}

/**
 * Officially supported server-side inspection: GET /debug_token returns the
 * exact `expires_at` for the token when Meta provides one. No unsupported
 * "permanent token" or refresh mechanism is used.
 */
async function inspectToken(token: string): Promise<{ expiresAt: Date | null; exact: boolean; type: string }> {
  try {
    const res = await fetch(
      `${GRAPH}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`,
    );
    const json = (await res.json().catch(() => ({}))) as {
      data?: { expires_at?: number; type?: string; is_valid?: boolean };
    };
    const expiresAt = json.data?.expires_at;
    if (typeof expiresAt === "number" && expiresAt > 0) {
      return {
        expiresAt: new Date(expiresAt * 1000),
        exact: true,
        type: json.data?.type ? `${json.data.type} (long-lived)` : "long_lived_user_token",
      };
    }
  } catch {
    // Network/permission problem — fall back to the 60-day assumption.
  }
  return { expiresAt: null, exact: false, type: "long_lived_user_token" };
}

/**
 * Reads current metadata, and (re)creates it when the stored token changed.
 */
export async function syncTokenMetadata(): Promise<TokenStatus> {
  const token = env("META_ACCESS_TOKEN");
  const igAccountConfigured = Boolean(env("META_IG_ACCOUNT_ID"));

  if (!token) {
    return {
      state: "missing",
      configured: false,
      tokenType: "long_lived_user_token",
      tokenCreatedAt: null,
      tokenExpiresAt: null,
      tokenLastUpdatedAt: null,
      daysRemaining: null,
      expiresInExact: false,
      igAccountConfigured,
      message: "META_ACCESS_TOKEN belum diisi di secret server.",
    };
  }

  const client = await db();
  const fp = await fingerprint(token);
  const { data } = await client
    .from("meta_token_meta")
    .select("*")
    .eq("id", "default")
    .maybeSingle();
  let row = data as MetaRow | null;

  if (!row || row.token_fingerprint !== fp) {
    const now = new Date();
    const inspected = await inspectToken(token);
    const expiresAt =
      inspected.expiresAt ?? new Date(now.getTime() + DEFAULT_LIFETIME_DAYS * 86_400_000);
    const payload = {
      id: "default",
      token_fingerprint: fp,
      token_type: inspected.type,
      token_created_at: now.toISOString(),
      token_expires_at: expiresAt.toISOString(),
      token_last_updated_at: now.toISOString(),
      expires_in_exact: inspected.exact,
      meta_expires_in_seconds: inspected.expiresAt
        ? Math.floor((inspected.expiresAt.getTime() - now.getTime()) / 1000)
        : null,
      last_checked_at: now.toISOString(),
    };
    const { data: upserted } = await client
      .from("meta_token_meta")
      .upsert(payload, { onConflict: "id" })
      .select("*")
      .maybeSingle();
    row = (upserted as MetaRow | null) ?? (payload as unknown as MetaRow);
  }

  return describe(row, igAccountConfigured);
}

function describe(row: MetaRow, igAccountConfigured: boolean): TokenStatus {
  const expires = new Date(row.token_expires_at).getTime();
  const msRemaining = expires - Date.now();
  const daysRemaining = Math.floor(msRemaining / 86_400_000);
  const state: TokenState =
    msRemaining <= 0 ? "expired" : daysRemaining <= WARN_DAYS ? "expiring_soon" : "active";

  if (state === "expiring_soon") {
    console.warn(
      `[meta-token] Meta access token expires in ${daysRemaining} day(s) (${row.token_expires_at}). Renew META_ACCESS_TOKEN.`,
    );
  }
  if (state === "expired") {
    console.error(`[meta-token] ${TOKEN_EXPIRED_MESSAGE} (expired ${row.token_expires_at})`);
  }

  return {
    state,
    configured: true,
    tokenType: row.token_type,
    tokenCreatedAt: row.token_created_at,
    tokenExpiresAt: row.token_expires_at,
    tokenLastUpdatedAt: row.token_last_updated_at,
    daysRemaining,
    expiresInExact: row.expires_in_exact,
    igAccountConfigured,
    message:
      state === "expired"
        ? TOKEN_EXPIRED_MESSAGE
        : state === "expiring_soon"
          ? `Token kedaluwarsa dalam ${daysRemaining} hari — segera perbarui META_ACCESS_TOKEN.`
          : `Token aktif, sisa ${daysRemaining} hari.`,
  };
}

/**
 * Returns credentials for publishing, or throws when the token is missing or
 * expired. Both Instant Publish and the scheduler use this single source.
 */
export async function requirePublishCredentials() {
  const token = env("META_ACCESS_TOKEN");
  const igAccountId = env("META_IG_ACCOUNT_ID");
  if (!token) throw new Error("META_ACCESS_TOKEN belum dikonfigurasi di server.");
  if (!igAccountId) throw new Error("META_IG_ACCOUNT_ID belum dikonfigurasi di server.");

  const status = await syncTokenMetadata();
  if (status.state === "expired") throw new Error(TOKEN_EXPIRED_MESSAGE);

  return { token, igAccountId, status };
}

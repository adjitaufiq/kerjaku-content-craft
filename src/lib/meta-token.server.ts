/**
 * Server-only Meta/Instagram credential lifecycle.
 *
 * Source of truth = the encrypted runtime credential store
 * (public.meta_credentials, service-role only). The legacy server secrets
 * META_ACCESS_TOKEN / META_IG_ACCOUNT_ID act as a read-only fallback until an
 * admin saves a token in the app, so publishing never goes down during
 * migration. The raw token is never returned to the browser or logged.
 */
import {
  fingerprint,
  inspectToken,
  maskToken,
  readCredentialRow,
  type CredentialRow,
} from "@/lib/meta-credentials.server";

export const TOKEN_EXPIRED_MESSAGE =
  "Instagram connection expired. Update the Meta access token to continue publishing.";

export const DEFAULT_LIFETIME_DAYS = 60;
const WARN_DAYS = 7;

export type TokenState = "missing" | "active" | "expiring_soon" | "expired";
export type CredentialSource = "runtime" | "secret" | "none";

export type TokenStatus = {
  state: TokenState;
  configured: boolean;
  source: CredentialSource;
  tokenType: string;
  tokenMask: string | null;
  tokenFingerprint: string | null;
  igAccountId: string | null;
  igAccountConfigured: boolean;
  scopes: string[];
  appId: string | null;
  tokenCreatedAt: string | null;
  tokenExpiresAt: string | null;
  tokenLastUpdatedAt: string | null;
  daysRemaining: number | null;
  expiresInExact: boolean;
  version: number | null;
  message: string;
};

function env(name: string) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : null;
}

const MISSING_STATUS: TokenStatus = {
  state: "missing",
  configured: false,
  source: "none",
  tokenType: "long_lived_user_token",
  tokenMask: null,
  tokenFingerprint: null,
  igAccountId: null,
  igAccountConfigured: false,
  scopes: [],
  appId: null,
  tokenCreatedAt: null,
  tokenExpiresAt: null,
  tokenLastUpdatedAt: null,
  daysRemaining: null,
  expiresInExact: false,
  version: null,
  message: "Belum ada Meta access token tersimpan. Tambahkan lewat Settings → Instagram Integration.",
};

function describe(input: {
  source: CredentialSource;
  tokenType: string;
  tokenMask: string;
  tokenFingerprint: string;
  igAccountId: string | null;
  scopes: string[];
  appId: string | null;
  createdAt: string;
  expiresAt: string;
  lastUpdatedAt: string;
  exact: boolean;
  version: number | null;
}): TokenStatus {
  const msRemaining = new Date(input.expiresAt).getTime() - Date.now();
  const daysRemaining = Math.floor(msRemaining / 86_400_000);
  const state: TokenState =
    msRemaining <= 0 ? "expired" : daysRemaining <= WARN_DAYS ? "expiring_soon" : "active";

  if (state === "expiring_soon") {
    console.warn(
      `[meta-credentials] Meta token expires in ${daysRemaining} day(s) — admin should replace it in the app.`,
    );
  }
  if (state === "expired") {
    console.error(`[meta-credentials] ${TOKEN_EXPIRED_MESSAGE}`);
  }

  return {
    state,
    configured: true,
    source: input.source,
    tokenType: input.tokenType,
    tokenMask: input.tokenMask,
    tokenFingerprint: input.tokenFingerprint,
    igAccountId: input.igAccountId,
    igAccountConfigured: Boolean(input.igAccountId),
    scopes: input.scopes,
    appId: input.appId,
    tokenCreatedAt: input.createdAt,
    tokenExpiresAt: input.expiresAt,
    tokenLastUpdatedAt: input.lastUpdatedAt,
    daysRemaining,
    expiresInExact: input.exact,
    version: input.version,
    message:
      state === "expired"
        ? TOKEN_EXPIRED_MESSAGE
        : state === "expiring_soon"
          ? `Token kedaluwarsa dalam ${daysRemaining} hari — segera perbarui dari halaman Instagram Integration.`
          : `Koneksi aktif, sisa ${daysRemaining} hari.`,
  };
}

function statusFromRow(row: CredentialRow): TokenStatus {
  return describe({
    source: "runtime",
    tokenType: row.token_type,
    tokenMask: `••••${row.token_fingerprint.slice(-4)}`,
    tokenFingerprint: row.token_fingerprint,
    igAccountId: row.ig_account_id,
    scopes: row.scopes ?? [],
    appId: row.app_id,
    createdAt: row.token_created_at,
    expiresAt: row.token_expires_at,
    lastUpdatedAt: row.token_last_updated_at,
    exact: row.expires_in_exact,
    version: row.version,
  });
}

/** Metadata-only status for the admin UI and the scheduler gate. */
export async function getCredentialStatus(): Promise<TokenStatus> {
  const row = await readCredentialRow();
  if (row) return statusFromRow(row);

  // Legacy secret fallback (pre-migration).
  const token = env("META_ACCESS_TOKEN");
  const igAccountId = env("META_IG_ACCOUNT_ID");
  if (!token) return MISSING_STATUS;

  const inspected = await inspectToken(token, null);
  const now = new Date();
  const expiresAt =
    inspected.expiresAt ?? new Date(now.getTime() + DEFAULT_LIFETIME_DAYS * 86_400_000);

  if (!inspected.valid) {
    return {
      ...MISSING_STATUS,
      state: "expired",
      configured: true,
      source: "secret",
      igAccountId,
      igAccountConfigured: Boolean(igAccountId),
      tokenMask: maskToken(token),
      tokenFingerprint: fingerprint(token),
      message: TOKEN_EXPIRED_MESSAGE,
    };
  }

  return describe({
    source: "secret",
    tokenType: inspected.type ?? "long_lived_user_token",
    tokenMask: maskToken(token),
    tokenFingerprint: fingerprint(token),
    igAccountId,
    scopes: inspected.scopes ?? [],
    appId: inspected.appId ?? null,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    lastUpdatedAt: now.toISOString(),
    exact: Boolean(inspected.exact),
    version: null,
  });
}

/** Backwards-compatible alias used by existing callers. */
export const syncTokenMetadata = getCredentialStatus;

/**
 * Single credential source for BOTH Instant Publish and the Schedule runner.
 * Throws when the credential is missing or expired.
 */
export async function requirePublishCredentials() {
  const row = await readCredentialRow();

  if (row) {
    const status = statusFromRow(row);
    if (status.state === "expired") throw new Error(TOKEN_EXPIRED_MESSAGE);
    const igAccountId = row.ig_account_id ?? env("META_IG_ACCOUNT_ID");
    if (!igAccountId) throw new Error("Instagram Account ID belum dikonfigurasi.");
    const { decryptToken } = await import("@/lib/meta-credentials.server");
    return { token: decryptToken(row.token_ciphertext), igAccountId, status };
  }

  const token = env("META_ACCESS_TOKEN");
  const igAccountId = env("META_IG_ACCOUNT_ID");
  if (!token || !igAccountId) throw new Error(TOKEN_EXPIRED_MESSAGE);

  const status = await getCredentialStatus();
  if (status.state === "expired") throw new Error(TOKEN_EXPIRED_MESSAGE);
  return { token, igAccountId, status };
}

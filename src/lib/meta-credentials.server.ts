/**
 * Server-only secure runtime credential store for the Meta/Instagram token.
 *
 * The raw token is encrypted (AES-256-GCM) with META_CREDENTIAL_ENC_KEY and
 * written to public.meta_credentials, a table with RLS enabled and NO policies
 * and NO grants for anon/authenticated — only the service-role client used by
 * these server-only helpers can read or write it. The plaintext token never
 * leaves this module.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const GRAPH = "https://graph.facebook.com/v19.0";

export const REQUIRED_SCOPES = ["instagram_basic", "instagram_content_publish"];

function encKey(): Buffer {
  const raw = process.env["META_CREDENTIAL_ENC_KEY"];
  if (!raw) throw new Error("META_CREDENTIAL_ENC_KEY belum dikonfigurasi di server.");
  return createHash("sha256").update(raw).digest();
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

export function decryptToken(stored: string): string {
  const buf = Buffer.from(stored, "base64");
  const decipher = createDecipheriv("aes-256-gcm", encKey(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}

export function fingerprint(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 24);
}

/** Last 4 characters only — used for a masked reference in the admin UI. */
export function maskToken(token: string): string {
  return `••••••••${token.slice(-4)}`;
}

export type CredentialRow = {
  id: string;
  token_ciphertext: string;
  token_fingerprint: string;
  ig_account_id: string | null;
  token_type: string;
  scopes: string[];
  app_id: string | null;
  status: string;
  expires_in_exact: boolean;
  token_created_at: string;
  token_expires_at: string;
  token_last_updated_at: string;
  updated_by: string | null;
  version: number;
};

async function table() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return (supabaseAdmin as unknown as { from: (t: string) => any }).from("meta_credentials");
}

export async function readCredentialRow(): Promise<CredentialRow | null> {
  const { data } = await (await table()).select("*").eq("id", "default").maybeSingle();
  return (data as CredentialRow | null) ?? null;
}

const SHORT_LIVED_THRESHOLD_MS = 7 * 86_400_000;

export type ExchangeResult = {
  token: string;
  exchanged: boolean;
  note: string;
  expiresInSeconds: number | null;
};

/**
 * Exchanges a short-lived user token for a long-lived (~60 day) one using the
 * official endpoint. Requires META_APP_ID + META_APP_SECRET server secrets.
 */
export async function exchangeForLongLivedToken(token: string): Promise<ExchangeResult> {
  const appId = process.env["META_APP_ID"];
  const appSecret = process.env["META_APP_SECRET"];
  if (!appId || !appSecret) {
    return {
      token,
      exchanged: false,
      note: "META_APP_ID/META_APP_SECRET belum dikonfigurasi, token disimpan apa adanya.",
      expiresInSeconds: null,
    };
  }

  try {
    const url =
      `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token` +
      `&client_id=${encodeURIComponent(appId)}` +
      `&client_secret=${encodeURIComponent(appSecret)}` +
      `&fb_exchange_token=${encodeURIComponent(token)}`;
    const res = await fetch(url);
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok || json?.error || !json?.access_token) {
      return {
        token,
        exchanged: false,
        note: `Gagal menukar ke long-lived token: ${json?.error?.message ?? "respons Meta tidak valid"}`,
        expiresInSeconds: null,
      };
    }
    const expiresInSeconds = Number(json.expires_in);
    const minimumLongLivedSeconds = 30 * 86_400;
    if (!Number.isFinite(expiresInSeconds) || expiresInSeconds < minimumLongLivedSeconds) {
      const duration = Number.isFinite(expiresInSeconds)
        ? `${Math.max(0, Math.floor(expiresInSeconds / 3600))} jam`
        : "tidak diketahui";
      return {
        token,
        exchanged: false,
        note: `Meta tidak menerbitkan long-lived token. Masa berlaku hasil pertukaran: ${duration}. Pastikan token dibuat oleh Meta App yang sama dengan konfigurasi CMS.`,
        expiresInSeconds: Number.isFinite(expiresInSeconds) ? expiresInSeconds : null,
      };
    }
    return {
      token: json.access_token as string,
      exchanged: true,
      note: `Ditukar ke long-lived token (${Math.floor(expiresInSeconds / 86_400)} hari).`,
      expiresInSeconds,
    };
  } catch {
    return {
      token,
      exchanged: false,
      note: "Tidak bisa menghubungi Meta untuk menukar token.",
      expiresInSeconds: null,
    };
  }
}

export type Inspection = {
  valid: boolean;
  shortLived?: boolean;
  error?: string;
  appId?: string;
  type?: string;
  scopes?: string[];
  expiresAt?: Date | null;
  exact?: boolean;
  igUsername?: string | undefined;
};

/**
 * Official server-side inspection through GET /debug_token, plus an Instagram
 * publishing-capability probe against the configured IG Business account.
 */
export async function inspectToken(token: string, igAccountId: string | null): Promise<Inspection> {
  let json: any;
  try {
    const appId = process.env["META_APP_ID"];
    const appSecret = process.env["META_APP_SECRET"];
    const inspectorToken = appId && appSecret ? `${appId}|${appSecret}` : token;
    const res = await fetch(
      `${GRAPH}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(inspectorToken)}`,
    );
    json = await res.json().catch(() => ({}));
  } catch {
    return { valid: false, error: "Tidak bisa menghubungi Meta Graph API untuk validasi token." };
  }

  const data = json?.data;
  if (!data || json?.error) {
    return {
      valid: false,
      error: json?.error?.message ?? "Token ditolak oleh Meta (debug_token gagal).",
    };
  }
  if (data.is_valid === false) {
    return { valid: false, error: data.error?.message ?? "Token tidak valid menurut Meta." };
  }
  if (!data.app_id) {
    return { valid: false, error: "Token tidak terhubung ke aplikasi Meta manapun." };
  }

  const scopes: string[] = Array.isArray(data.scopes) ? data.scopes : [];
  const missing = REQUIRED_SCOPES.filter((s) => !scopes.includes(s));
  if (missing.length) {
    return { valid: false, error: `Token kurang izin: ${missing.join(", ")}.` };
  }

  const expiresAt =
    typeof data.expires_at === "number" && data.expires_at > 0
      ? new Date(data.expires_at * 1000)
      : null;
  if (expiresAt && expiresAt.getTime() <= Date.now()) {
    return { valid: false, error: "Token sudah kedaluwarsa menurut Meta." };
  }

  let igUsername: string | undefined;
  if (igAccountId) {
    try {
      const res = await fetch(
        `${GRAPH}/${igAccountId}?fields=id,username&access_token=${encodeURIComponent(token)}`,
      );
      const igJson: any = await res.json().catch(() => ({}));
      if (!res.ok || igJson?.error) {
        return {
          valid: false,
          error: `Token tidak punya akses ke Instagram Account ID ${igAccountId}: ${
            igJson?.error?.message ?? "akses ditolak"
          }`,
        };
      }
      igUsername = igJson?.username;
    } catch {
      return { valid: false, error: "Gagal memverifikasi akun Instagram dengan token baru." };
    }
  }

  // A user token without an exact expiry can never be trusted as long-lived.
  const shortLived = !expiresAt || expiresAt.getTime() - Date.now() < SHORT_LIVED_THRESHOLD_MS;

  return {
    valid: true,
    shortLived,
    appId: String(data.app_id),
    type: `${data.type ?? "USER"} (${shortLived ? "short-lived" : "long-lived"})`,
    scopes,
    expiresAt,
    exact: Boolean(expiresAt),
    igUsername,
  };
}

/** Writes the validated token into the encrypted store (optimistic locking). */
export async function writeCredential(params: {
  token: string;
  igAccountId: string | null;
  inspection: Inspection;
  userId: string;
  expectedVersion: number | null;
}) {
  const t = await table();
  const existing = await readCredentialRow();

  if (!params.inspection.expiresAt || !params.inspection.exact) {
    throw new Error(
      "Meta tidak mengembalikan masa berlaku token yang dapat diverifikasi. Token lama tetap digunakan.",
    );
  }

  if (params.inspection.shortLived) {
    throw new Error(
      "Token hasil validasi masih short-lived. Token lama tetap digunakan dan token baru tidak disimpan.",
    );
  }

  if (existing && params.expectedVersion != null && existing.version !== params.expectedVersion) {
    throw new Error(
      "Kredensial sudah diperbarui dari sesi lain. Muat ulang halaman sebelum menyimpan.",
    );
  }

  const now = new Date();
  const expiresAt = params.inspection.expiresAt;

  const payload = {
    id: "default",
    token_ciphertext: encryptToken(params.token),
    token_fingerprint: fingerprint(params.token),
    ig_account_id: params.igAccountId,
    token_type: params.inspection.type ?? "long_lived_user_token",
    scopes: params.inspection.scopes ?? [],
    app_id: params.inspection.appId ?? null,
    status: "active",
    expires_in_exact: Boolean(params.inspection.exact),
    token_created_at: now.toISOString(),
    token_expires_at: expiresAt.toISOString(),
    token_last_updated_at: now.toISOString(),
    updated_by: params.userId,
    version: (existing?.version ?? 0) + 1,
  };

  if (existing) {
    const { data, error } = await t
      .update(payload)
      .eq("id", "default")
      .eq("version", existing.version)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      throw new Error(
        "Kredensial sudah diperbarui dari sesi lain. Muat ulang halaman sebelum menyimpan.",
      );
    }
    return data as CredentialRow;
  }

  const { data, error } = await t.insert(payload).select("*").maybeSingle();
  if (error) throw new Error(error.message);
  return data as CredentialRow;
}

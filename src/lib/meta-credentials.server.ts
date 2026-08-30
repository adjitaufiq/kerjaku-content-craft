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

export type Inspection = {
  valid: boolean;
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
    const res = await fetch(
      `${GRAPH}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`,
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

  return {
    valid: true,
    appId: String(data.app_id),
    type: data.type ? `${data.type} (long-lived)` : "long_lived_user_token",
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

  if (existing && params.expectedVersion != null && existing.version !== params.expectedVersion) {
    throw new Error(
      "Kredensial sudah diperbarui dari sesi lain. Muat ulang halaman sebelum menyimpan.",
    );
  }

  const now = new Date();
  const expiresAt =
    params.inspection.expiresAt ?? new Date(now.getTime() + 60 * 86_400_000);

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

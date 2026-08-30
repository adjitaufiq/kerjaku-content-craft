import { createServerFn } from "@tanstack/react-start";

type PublishInput = {
  imageUrl: string;
  caption: string;
};

const GRAPH = "https://graph.facebook.com/v19.0";

function validate(input: PublishInput): PublishInput {
  if (!input.imageUrl?.trim()) throw new Error("Foto belum diunggah.");
  return input;
}

function humanize(message: string) {
  if (/whitelist/i.test(message)) {
    return "Meta menolak permintaan (User must be on whitelist). Ini terjadi bila memakai penjadwalan bawaan Meta (scheduled_publish_time) yang hanya untuk Facebook Page ter-whitelist. Penjadwalan kini ditangani aplikasi, jadi coba ulangi; jika tetap muncul, pastikan token punya izin instagram_content_publish dan akun IG Business terhubung ke Page.";
  }
  return message;
}

async function graphPost(url: string, body: Record<string, string>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  const json = (await res.json().catch(() => ({}))) as {
    id?: string;
    error?: { message?: string; error_user_msg?: string; code?: number; error_subcode?: number };
  };
  if (!res.ok || json.error) {
    const code = json.error?.code;
    const subcode = json.error?.error_subcode;
    if (code === 190 || subcode === 463 || subcode === 467) {
      // OAuth token invalid/expired — surface the canonical message.
      throw new Error("Instagram access token expired. Please update the Meta access token.");
    }
    const msg =
      json.error?.error_user_msg ?? json.error?.message ?? `Meta API error (${res.status})`;
    throw new Error(humanize(msg));
  }
  if (!json.id) throw new Error("Meta API tidak mengembalikan ID.");
  return json.id;
}

/**
 * Publishes immediately using the 2-step Instagram Content Publishing flow.
 * Credentials come from server-side secrets only (META_ACCESS_TOKEN /
 * META_IG_ACCOUNT_ID) and are shared by Instant Publish and the scheduler.
 *
 * Meta's `scheduled_publish_time` / `published=false` is intentionally NOT used:
 * it is a Facebook Page-only, whitelist-gated feature.
 */
export const publishToInstagram = createServerFn({ method: "POST" })
  .inputValidator((input: PublishInput) => validate(input))
  .handler(async ({ data }) => {
    const { requirePublishCredentials } = await import("@/lib/meta-token.server");
    const { token, igAccountId } = await requirePublishCredentials();

    const creationId = await graphPost(`${GRAPH}/${igAccountId}/media`, {
      image_url: data.imageUrl,
      caption: data.caption ?? "",
      access_token: token,
    });
    const postId = await graphPost(`${GRAPH}/${igAccountId}/media_publish`, {
      creation_id: creationId,
      access_token: token,
    });
    return { mode: "published" as const, creationId, postId };
  });

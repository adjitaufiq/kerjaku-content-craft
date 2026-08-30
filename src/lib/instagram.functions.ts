import { createServerFn } from "@tanstack/react-start";

type PublishInput = {
  igAccountId: string;
  accessToken: string;
  imageUrl: string;
  caption: string;
};

const GRAPH = "https://graph.facebook.com/v19.0";

function validate(input: PublishInput): PublishInput {
  if (!input.igAccountId?.trim()) throw new Error("Instagram Business Account ID belum diisi.");
  if (!input.accessToken?.trim()) throw new Error("Meta Access Token belum diisi.");
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
    error?: { message?: string; error_user_msg?: string };
  };
  if (!res.ok || json.error) {
    const msg =
      json.error?.error_user_msg ?? json.error?.message ?? `Meta API error (${res.status})`;
    throw new Error(humanize(msg));
  }
  if (!json.id) throw new Error("Meta API tidak mengembalikan ID.");
  return json.id;
}

/**
 * Publishes immediately using the 2-step Instagram Content Publishing flow.
 * Meta's `scheduled_publish_time` / `published=false` is intentionally NOT used:
 * it is a Facebook Page-only, whitelist-gated feature and returns
 * "(#200) User must be on whitelist" for Instagram accounts.
 */
export const publishToInstagram = createServerFn({ method: "POST" })
  .inputValidator((input: PublishInput) => validate(input))
  .handler(async ({ data }) => {
    const creationId = await graphPost(`${GRAPH}/${data.igAccountId}/media`, {
      image_url: data.imageUrl,
      caption: data.caption ?? "",
      access_token: data.accessToken,
    });
    const postId = await graphPost(`${GRAPH}/${data.igAccountId}/media_publish`, {
      creation_id: creationId,
      access_token: data.accessToken,
    });
    return { mode: "published" as const, creationId, postId };
  });

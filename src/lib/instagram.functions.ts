import { createServerFn } from "@tanstack/react-start";

type PublishInput = {
  imageUrls: string[];
  caption: string;
};

const GRAPH = "https://graph.facebook.com/v19.0";
export const MAX_CAROUSEL = 10;

function validate(input: PublishInput): PublishInput {
  const urls = (input.imageUrls ?? []).filter((u) => typeof u === "string" && u.trim());
  if (!urls.length) throw new Error("Foto belum diunggah.");
  if (urls.length > MAX_CAROUSEL)
    throw new Error(`Instagram hanya mengizinkan maksimal ${MAX_CAROUSEL} foto per postingan.`);
  return { imageUrls: urls, caption: input.caption ?? "" };
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
 * Builds the media container for a single photo or a carousel (2-10 photos)
 * and returns the creation id ready for `media_publish`.
 */
export async function createMediaContainer(opts: {
  igAccountId: string;
  token: string;
  imageUrls: string[];
  caption: string;
}) {
  const { igAccountId, token, imageUrls, caption } = opts;
  if (imageUrls.length === 1) {
    return graphPost(`${GRAPH}/${igAccountId}/media`, {
      image_url: imageUrls[0]!,
      caption,
      access_token: token,
    });
  }
  const children: string[] = [];
  for (const url of imageUrls) {
    children.push(
      await graphPost(`${GRAPH}/${igAccountId}/media`, {
        image_url: url,
        is_carousel_item: "true",
        access_token: token,
      }),
    );
  }
  return graphPost(`${GRAPH}/${igAccountId}/media`, {
    media_type: "CAROUSEL",
    children: children.join(","),
    caption,
    access_token: token,
  });
}

export async function publishMedia(igAccountId: string, token: string, creationId: string) {
  return graphPost(`${GRAPH}/${igAccountId}/media_publish`, {
    creation_id: creationId,
    access_token: token,
  });
}

/**
 * Publishes immediately using the Instagram Content Publishing flow —
 * single photo or carousel (2-10 photos).
 *
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

    const creationId = await createMediaContainer({
      igAccountId,
      token,
      imageUrls: data.imageUrls,
      caption: data.caption ?? "",
    });
    const postId = await publishMedia(igAccountId, token, creationId);
    return { mode: "published" as const, creationId, postId };
  });

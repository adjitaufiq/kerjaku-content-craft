import { createServerFn } from "@tanstack/react-start";

type PublishInput = {
  igAccountId: string;
  accessToken: string;
  imageUrl: string;
  caption: string;
  /** Unix seconds. When present the post is scheduled by Meta instead of published now. */
  scheduledPublishTime?: number;
};

const GRAPH = "https://graph.facebook.com/v19.0";

function validate(input: PublishInput): PublishInput {
  if (!input.igAccountId?.trim()) throw new Error("Instagram Business Account ID belum diisi.");
  if (!input.accessToken?.trim()) throw new Error("Meta Access Token belum diisi.");
  if (!input.imageUrl?.trim()) throw new Error("Foto belum diunggah.");
  return input;
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
    throw new Error(msg);
  }
  if (!json.id) throw new Error("Meta API tidak mengembalikan ID.");
  return json.id;
}

export const publishToInstagram = createServerFn({ method: "POST" })
  .inputValidator((input: PublishInput) => validate(input))
  .handler(async ({ data }) => {
    const base: Record<string, string> = {
      image_url: data.imageUrl,
      caption: data.caption ?? "",
      access_token: data.accessToken,
    };

    if (data.scheduledPublishTime) {
      const creationId = await graphPost(`${GRAPH}/${data.igAccountId}/media`, {
        ...base,
        published: "false",
        scheduled_publish_time: String(data.scheduledPublishTime),
      });
      return { mode: "scheduled" as const, creationId, postId: null as string | null };
    }

    const creationId = await graphPost(`${GRAPH}/${data.igAccountId}/media`, base);
    const postId = await graphPost(`${GRAPH}/${data.igAccountId}/media_publish`, {
      creation_id: creationId,
      access_token: data.accessToken,
    });
    return { mode: "published" as const, creationId, postId };
  });

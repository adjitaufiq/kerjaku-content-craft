const GRAPH = "https://graph.facebook.com/v19.0";
export class PublishingError extends Error {
  constructor(
    public readonly code: "auth" | "rate_limit" | "rejected" | "unknown",
    public readonly retryable: boolean,
  ) {
    super(`Instagram publishing: ${code}`);
  }
}
export async function graphPost(path: string, body: Record<string, string>) {
  let response: Response;
  try {
    response = await fetch(`${GRAPH}/${path}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new PublishingError("unknown", false);
  }
  const json: { id?: string; error?: { code?: number } } = await response.json().catch(() => ({}));
  if (!response.ok || json.error) {
    if (json.error?.code === 190) throw new PublishingError("auth", false);
    if (response.status === 429 || json.error?.code === 4 || json.error?.code === 613)
      throw new PublishingError("rate_limit", true);
    if (response.status >= 500) throw new PublishingError("unknown", false);
    throw new PublishingError("rejected", false);
  }
  if (!json.id) throw new PublishingError("unknown", false);
  return json.id;
}
export async function createMediaContainer(opts: {
  igAccountId: string;
  token: string;
  imageUrls: string[];
  caption: string;
}) {
  const first = opts.imageUrls[0];
  if (!first || opts.imageUrls.length > 10) throw new PublishingError("rejected", false);
  if (opts.imageUrls.length === 1)
    return graphPost(`${opts.igAccountId}/media`, {
      image_url: first,
      caption: opts.caption,
      access_token: opts.token,
    });
  const children: string[] = [];
  for (const image of opts.imageUrls)
    children.push(
      await graphPost(`${opts.igAccountId}/media`, {
        image_url: image,
        is_carousel_item: "true",
        access_token: opts.token,
      }),
    );
  return graphPost(`${opts.igAccountId}/media`, {
    media_type: "CAROUSEL",
    children: children.join(","),
    caption: opts.caption,
    access_token: opts.token,
  });
}
export async function getContainerStatus(creationId: string, token: string): Promise<string> {
  const response = await fetch(`${GRAPH}/${creationId}?fields=status_code`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  });
  const json: { status_code?: string } = await response.json();
  if (!response.ok || !json.status_code) throw new PublishingError("unknown", false);
  return json.status_code;
}

/** Server-only helpers for the Content Downloader research module. */

export type ExtractedMedia = {
  creatorUsername: string | null;
  contentType: string;
  caption: string;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  resolution: string | null;
  duration: number | null;
};

const INSTAGRAM_HOSTS = ["instagram.com", "www.instagram.com", "m.instagram.com", "instagr.am"];

export function normalizeUrl(raw: string): { url: string; contentType: string } {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new Error("Tautan tidak valid. Contoh: https://www.instagram.com/reel/xxxxx/");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Tautan harus diawali https://");
  }
  if (!INSTAGRAM_HOSTS.includes(parsed.hostname)) {
    throw new Error("Saat ini hanya tautan Instagram publik yang didukung.");
  }
  const segments = parsed.pathname.split("/").filter(Boolean);
  const kind = segments[0] ?? "";
  const contentType =
    kind === "reel" || kind === "reels" ? "reel" : kind === "tv" ? "video" : kind === "p" ? "post" : "";
  if (!contentType || !segments[1]) {
    throw new Error("Tautan harus mengarah ke Reel atau postingan publik, misalnya /reel/xxxxx/.");
  }
  return {
    url: `https://www.instagram.com/${kind === "reels" ? "reel" : kind}/${segments[1]}/`,
    contentType,
  };
}

function metaTag(html: string, property: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${property}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']*)["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeEntities(m[1]);
  }
  return null;
}

function decodeEntities(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/**
 * Reads only the publicly served Open Graph metadata of a public Instagram
 * page. No login, no private content, no protection bypass.
 */
export async function extractPublicMetadata(url: string, contentType: string): Promise<ExtractedMedia> {
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; KerjakuPublisher/1.0; +https://kerjaku-content-craft.lovable.app)",
      accept: "text/html,application/xhtml+xml",
      "accept-language": "id-ID,id;q=0.9,en;q=0.8",
    },
  });

  if (!res.ok) {
    throw new Error(
      res.status === 404
        ? "Konten tidak ditemukan atau sudah dihapus."
        : "Instagram tidak memberikan data publik untuk tautan ini (mungkin akun privat atau dibatasi).",
    );
  }

  const html = await res.text();
  const title = metaTag(html, "og:title") ?? "";
  const description = metaTag(html, "og:description") ?? "";
  const thumbnailUrl = metaTag(html, "og:image");
  const videoUrl = metaTag(html, "og:video") ?? metaTag(html, "og:video:secure_url");
  const width = metaTag(html, "og:video:width") ?? metaTag(html, "og:image:width");
  const height = metaTag(html, "og:video:height") ?? metaTag(html, "og:image:height");

  const handle =
    title.match(/@([A-Za-z0-9._]+)/)?.[1] ??
    description.match(/@([A-Za-z0-9._]+)/)?.[1] ??
    metaTag(html, "og:url")?.match(/instagram\.com\/([A-Za-z0-9._]+)\//)?.[1] ??
    null;

  if (!thumbnailUrl && !videoUrl) {
    throw new Error(MISSING_PREVIEW);
  }


  return {
    creatorUsername: handle,
    contentType,
    caption: decodeEntities(description).slice(0, 4000),
    thumbnailUrl,
    videoUrl,
    resolution: width && height ? `${width}x${height}` : null,
    duration: null,
  };
}

/** Stores a remote asset in the private research bucket. Returns the object path. */
export async function storeRemoteAsset(
  remoteUrl: string,
  folder: string,
  name: string,
): Promise<{ path: string; bytes: number } | null> {
  try {
    const res = await fetch(remoteUrl);
    if (!res.ok) return null;
    const buffer = new Uint8Array(await res.arrayBuffer());
    if (!buffer.byteLength) return null;
    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `${folder}/${name}`;
    const { error } = await supabaseAdmin.storage
      .from("content-research")
      .upload(path, buffer, { contentType, upsert: true });
    if (error) return null;
    return { path, bytes: buffer.byteLength };
  } catch {
    return null;
  }
}

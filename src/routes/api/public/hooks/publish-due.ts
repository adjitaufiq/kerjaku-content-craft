/**
 * Server-side scheduler hook.
 *
 * Called by pg_cron every few minutes so scheduled Instagram posts go live
 * even when nobody has the app open. Publishing itself reuses the exact same
 * credential source and 2-step Graph API flow as Instant Publish; only the
 * trigger is different.
 *
 * Safety rails:
 * - Bearer secret required (LOVABLE_CRON_SECRET).
 * - Bounded batch per run.
 * - Atomic claim (scheduled -> publishing) so a concurrent run or an open
 *   browser tab can never publish the same row twice.
 * - Circuit breaker: an expired/invalid Meta token stops the whole run.
 */
import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

const BATCH_SIZE = 5;
const GRAPH = "https://graph.facebook.com/v19.0";

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
      throw new Error("TOKEN_EXPIRED");
    }
    throw new Error(
      json.error?.error_user_msg ?? json.error?.message ?? `Meta API error (${res.status})`,
    );
  }
  if (!json.id) throw new Error("Meta API tidak mengembalikan ID.");
  return json.id;
}

/** Single photo, or a CAROUSEL container for 2-10 photos. */
async function createContainer(
  igAccountId: string,
  token: string,
  images: string[],
  caption: string,
) {
  if (images.length === 1) {
    return graphPost(`${GRAPH}/${igAccountId}/media`, {
      image_url: images[0]!,
      caption,
      access_token: token,
    });
  }
  const children: string[] = [];
  for (const url of images) {
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

async function runDueJobs() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Recover rows left in "publishing" by a crashed run/tab so they retry.
  await supabaseAdmin
    .from("content_logs")
    .update({ status: "scheduled" })
    .eq("status", "publishing")
    .lte("scheduled_at", new Date(Date.now() - 15 * 60 * 1000).toISOString());

  const { data: due, error } = await supabaseAdmin
    .from("content_logs")
    .select("id, content_number, caption, image_url, image_urls")
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(BATCH_SIZE);
  if (error) throw new Error(error.message);
  if (!due?.length) return { claimed: 0, published: 0, failed: 0, paused: false };

  const { requirePublishCredentials } = await import("@/lib/meta-token.server");
  const { token, igAccountId } = await requirePublishCredentials();

  let claimed = 0;
  let published = 0;
  let failed = 0;
  let paused = false;

  for (const job of due) {
    // Atomic claim — only one worker (cron run or open tab) wins the row.
    const { data: won } = await supabaseAdmin
      .from("content_logs")
      .update({ status: "publishing" })
      .eq("id", job.id)
      .eq("status", "scheduled")
      .select("id");
    if (!won?.length) continue;
    claimed += 1;

    const images = job.image_urls?.length ? job.image_urls : job.image_url ? [job.image_url] : [];
    if (!images.length) {
      failed += 1;
      await supabaseAdmin
        .from("content_logs")
        .update({ status: "failed", error_message: "Foto belum diunggah." })
        .eq("id", job.id);
      continue;
    }

    try {
      const creationId = await createContainer(igAccountId, token, images, job.caption ?? "");
      const postId = await graphPost(`${GRAPH}/${igAccountId}/media_publish`, {
        creation_id: creationId,
        access_token: token,
      });
      published += 1;
      await supabaseAdmin
        .from("content_logs")
        .update({
          status: "published",
          ig_creation_id: creationId,
          ig_post_id: postId,
          error_message: null,
        })
        .eq("id", job.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal publish terjadwal.";
      const expired = message === "TOKEN_EXPIRED";
      failed += 1;
      await supabaseAdmin
        .from("content_logs")
        .update({
          status: "failed",
          error_message: expired
            ? "Instagram access token expired. Please update the Meta access token."
            : message,
        })
        .eq("id", job.id);
      if (expired) {
        // Circuit breaker: stop the run, no further Meta calls until a new
        // token is saved from Settings.
        paused = true;
        break;
      }
    }
  }

  return { claimed, published, failed, paused };
}

export const Route = createFileRoute("/api/public/hooks/publish-due")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // pg_cron authenticates with PUBLISH_CRON_SECRET; the platform cron
        // secret is also accepted.
        const cronSecret = process.env["PUBLISH_CRON_SECRET"];
        const header = request.headers.get("authorization") ?? "";
        const provided = /^Bearer ([^\s,]+)$/.exec(header)?.[1];
        const ownSecretOk = Boolean(cronSecret && provided && provided === cronSecret);
        if (!ownSecretOk) {
          const denied = await authenticateCronRequest(request);
          if (denied) return denied;
        }
        try {
          const result = await runDueJobs();
          return Response.json({ ok: true, ...result });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          console.error("publish-due failed:", message);
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { publishToInstagram } from "@/lib/instagram.functions";
import { imagesOf } from "@/lib/content-data";
import { getMetaTokenStatus } from "@/lib/meta-token.functions";

export const TOKEN_EXPIRED_MESSAGE =
  "Instagram access token expired. Please update the Meta access token.";

/** Server-side token status (metadata only, never the token). */
export function useMetaTokenStatus() {
  const fetchStatus = useServerFn(getMetaTokenStatus);
  return useQuery({
    queryKey: ["meta-token-status"],
    queryFn: () => fetchStatus({}),
    staleTime: 60_000,
  });
}

/**
 * App-side scheduler. Meta's native Instagram scheduling is whitelist-gated,
 * so due posts are published by this runner while the app is open.
 */
export function useScheduleRunner() {
  const status = useMetaTokenStatus();
  const publish = useServerFn(publishToInstagram);
  const queryClient = useQueryClient();
  const running = useRef(false);

  const state = status.data?.state;
  const ready = state === "active" || state === "expiring_soon";

  useEffect(() => {
    if (!ready) return;

    async function tick() {
      if (running.current) return;
      running.current = true;
      try {
        const { data, error } = await supabase
          .from("content_logs")
          .select("*")
          .eq("status", "scheduled")
          .lte("scheduled_at", new Date().toISOString())
          .order("scheduled_at", { ascending: true })
          .limit(3);
        if (error || !data?.length) return;

        for (const job of data) {
          const images = imagesOf(job);
          if (!images.length) continue;
          // Claim the job first so a second open tab cannot publish it again.
          const { data: claimed } = await supabase
            .from("content_logs")
            .update({ status: "publishing" })
            .eq("id", job.id)
            .eq("status", "scheduled")
            .select("id");
          if (!claimed?.length) continue;
          try {
            const result = await publish({
              data: { imageUrls: images, caption: job.caption ?? "" },
            });
            await supabase
              .from("content_logs")
              .update({
                status: "published",
                ig_creation_id: result.creationId,
                ig_post_id: result.postId,
                error_message: null,
              })
              .eq("id", job.id);
            toast.success(`Konten #${job.content_number} tayang sesuai jadwal.`);
          } catch (err) {
            const message = err instanceof Error ? err.message : "Gagal publish terjadwal.";
            await supabase
              .from("content_logs")
              .update({ status: "failed", error_message: message })
              .eq("id", job.id);
            toast.error(`Konten #${job.content_number}: ${message}`);
            if (message.includes(TOKEN_EXPIRED_MESSAGE)) {
              // Token expired: stop this run and refresh status — no retries
              // until a new token is saved on the server.
              await queryClient.invalidateQueries({ queryKey: ["meta-token-status"] });
              break;
            }
          }
        }
        await queryClient.invalidateQueries({ queryKey: ["logs"] });
      } finally {
        running.current = false;
      }
    }

    void tick();
    const id = window.setInterval(() => void tick(), 60_000);
    return () => window.clearInterval(id);
  }, [ready, publish, queryClient]);
}

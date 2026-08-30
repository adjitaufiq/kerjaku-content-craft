import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { publishToInstagram } from "@/lib/instagram.functions";
import { useIgSettings } from "@/lib/ig-settings";

/**
 * App-side scheduler. Meta's native Instagram scheduling is whitelist-gated,
 * so due posts are published by this runner while the app is open.
 */
export function useScheduleRunner() {
  const { settings, configured } = useIgSettings();
  const publish = useServerFn(publishToInstagram);
  const queryClient = useQueryClient();
  const running = useRef(false);

  useEffect(() => {
    if (!configured) return;

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
          if (!job.image_url) continue;
          try {
            const result = await publish({
              data: {
                igAccountId: settings.igAccountId,
                accessToken: settings.accessToken,
                imageUrl: job.image_url,
                caption: job.caption ?? "",
              },
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
  }, [configured, settings.igAccountId, settings.accessToken, publish, queryClient]);
}

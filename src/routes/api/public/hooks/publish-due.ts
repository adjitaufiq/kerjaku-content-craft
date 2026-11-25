import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/hooks/publish-due")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Preserve the existing unmanaged callback credential until schedules can be inspected.
        const { timingSafeEqual } = await import("node:crypto");
        const secret = process.env["PUBLISH_CRON_SECRET"];
        const provided = /^Bearer ([^\s,]+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
        const left = new TextEncoder().encode(secret ?? "");
        const right = new TextEncoder().encode(provided ?? "");
        const legacyAllowed = Boolean(
          secret && provided && left.length === right.length && timingSafeEqual(left, right),
        );
        if (!legacyAllowed) {
          const denied = await authenticateCronRequest(request);
          if (denied) return denied;
        }
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { phase0Client } = await import("@/lib/phase0-db");
          const { error } = await phase0Client(supabaseAdmin)
            .from("craft_runtime_health")
            .update({ scheduler_verified_at: new Date().toISOString() })
            .eq("id", "default");
          if (error) throw new Error("RUNTIME_UNAVAILABLE");
          const { runPublishingQueue } = await import("@/lib/publishing-queue.server");
          return Response.json({ ok: true, ...(await runPublishingQueue()) });
        } catch {
          console.error(
            JSON.stringify({ event: "publish_scheduler_failure", code: "RUNTIME_UNAVAILABLE" }),
          );
          return Response.json(
            { ok: false, error: "Scheduler tidak tersedia; periksa status sistem." },
            { status: 503 },
          );
        }
      },
    },
  },
});

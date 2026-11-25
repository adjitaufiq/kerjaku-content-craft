import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";
import { workerInput, executeFactoryWorker } from "@/lib/factory-worker.server";

export const Route = createFileRoute("/api/public/factory/worker")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["CRAFT_WORKER_SECRET"];
        const supplied = request.headers.get("authorization")?.replace(/^Bearer /, "");
        const a = new TextEncoder().encode(secret ?? "");
        const b = new TextEncoder().encode(supplied ?? "");
        if (!secret || !supplied || a.length !== b.length || !timingSafeEqual(a, b))
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        const parsed = workerInput.safeParse(await request.json().catch(() => null));
        if (!parsed.success)
          return Response.json({ error: "Invalid worker request" }, { status: 400 });
        const storageOrigin = process.env["VITE_SUPABASE_URL"];
        if (!storageOrigin) return Response.json({ error: "Storage unavailable" }, { status: 503 });
        try {
          // Worker credential verified before privileged access; task/owner/lease checked again per operation.
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const result = await executeFactoryWorker(supabaseAdmin, parsed.data, storageOrigin);
          return Response.json(result);
        } catch (e) {
          console.error(
            JSON.stringify({
              event: "factory_worker_failure",
              message: e instanceof Error ? e.message : "Unavailable",
            }),
          );
          return Response.json(
            { error: "Factory unavailable; inspect persisted job state before retrying." },
            { status: 503 },
          );
        }
      },
    },
  },
});

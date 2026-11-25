import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCraftAdmin } from "./authorization";
import { phase0Client } from "./phase0-db";
import { schedulerIsVerified } from "./publishing-policy";

export const getSchedulerReadiness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await phase0Client(context.supabase)
      .from("craft_runtime_health")
      .select("server_scheduler_enabled,scheduler_verified_at,last_heartbeat_at")
      .eq("id", "default")
      .single();
    return { ready: !error && data ? schedulerIsVerified(data) : false, checked: !error };
  });
export type HealthProbe = { name: string; state: "PASS" | "FAIL" | "BLOCKED"; detail: string };
export const getSystemHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireCraftAdmin(context.supabase, context.userId);
    const checkedAt = new Date().toISOString();
    const db = phase0Client(context.supabase);
    const [database, runtime, pending, failed, storage] = await Promise.all([
      context.supabase
        .from("user_roles")
        .select("user_id", { count: "exact", head: true })
        .eq("user_id", context.userId),
      db.from("craft_runtime_health").select("*").eq("id", "default").single(),
      db
        .from("publishing_jobs")
        .select("id", { count: "exact", head: true })
        .in("state", ["pending", "leased", "creating_container", "container_ready"]),
      db
        .from("publishing_jobs")
        .select("id", { count: "exact", head: true })
        .in("state", ["failed", "reconciliation_required"]),
      context.supabase.storage.from("instagram-media").list(context.userId, { limit: 1 }),
    ]);
    const probes: HealthProbe[] = [
      {
        name: "Database",
        state: database.error ? "FAIL" : "PASS",
        detail: database.error ? "Koneksi gagal" : "Kueri pengguna berhasil",
      },
      {
        name: "Storage",
        state: storage.error ? "FAIL" : "PASS",
        detail: storage.error
          ? "Pemeriksaan penyimpanan gagal"
          : "Folder pengguna dapat diakses; isolasi perlu uji dua akun",
      },
    ];
    const heartbeat = runtime.data?.last_heartbeat_at;
    probes.push({
      name: "Scheduler heartbeat",
      state: heartbeat && Date.now() - Date.parse(heartbeat) < 10 * 60_000 ? "PASS" : "BLOCKED",
      detail: heartbeat ?? "Belum menerima callback terverifikasi",
    });
    const worker = runtime.data?.worker_heartbeat_at;
    probes.push({
      name: "Media worker",
      state: worker && Date.now() - Date.parse(worker) < 60_000 ? "PASS" : "BLOCKED",
      detail: worker ?? "Belum ada worker terhubung",
    });
    try {
      const { listModels } = await import("@lovable.dev/ai-gateway");
      const models = await listModels();
      probes.push({
        name: "AI provider",
        state: models.workspace_models === "included" ? "PASS" : "BLOCKED",
        detail:
          models.workspace_models === "included"
            ? "Katalog workspace dapat diakses; bukan pengujian inferensi"
            : "Model workspace belum terverifikasi",
      });
    } catch {
      probes.push({
        name: "AI provider",
        state: "FAIL",
        detail: "Katalog provider tidak dapat diakses",
      });
    }
    try {
      const { getCredentialStatus } = await import("./meta-token.server");
      const status = await getCredentialStatus();
      probes.push({
        name: "Instagram",
        state: status.state === "active" || status.state === "expiring_soon" ? "PASS" : "BLOCKED",
        detail: `${status.state}; tidak melakukan posting uji`,
      });
    } catch {
      probes.push({ name: "Instagram", state: "BLOCKED", detail: "Koneksi belum dapat diperiksa" });
    }
    return {
      checkedAt,
      probes,
      pending: pending.error ? null : pending.count,
      failed: failed.error ? null : failed.count,
      lastSuccess: runtime.data?.last_success_at ?? null,
    };
  });

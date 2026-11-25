import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSystemHealth } from "@/lib/system-health.functions";

export function SystemHealthPanel() {
  const check = useServerFn(getSystemHealth);
  const health = useQuery({ queryKey: ["system-health"], queryFn: () => check(), retry: false, refetchInterval: 60_000 });
  return <section className="mt-8 border-t border-border pt-6" aria-label="System Health">
    <div className="flex items-center justify-between gap-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><Activity className="size-4 text-primary" />System Health</h2>
      <Button variant="ghost" size="icon" aria-label="Periksa kesehatan sistem" title="Periksa kesehatan sistem" disabled={health.isFetching} onClick={() => void health.refetch()}><RefreshCw className="size-4" /></Button>
    </div>
    {health.isPending ? <p className="mt-4 text-sm text-muted-foreground">Memeriksa koneksi…</p> : health.isError ? <p className="mt-4 text-sm text-destructive" role="status">BLOCKED — pemeriksaan memerlukan sesi administrator dan database yang aktif.</p> : <>
      <dl className="mt-4 divide-y divide-border">
        {health.data.probes.map((probe) => <div key={probe.name} className="grid gap-1 py-3 sm:grid-cols-[180px_90px_1fr]"><dt className="text-sm font-medium">{probe.name}</dt><dd className={`text-xs font-semibold ${probe.state === "PASS" ? "text-accent" : probe.state === "FAIL" ? "text-destructive" : "text-muted-foreground"}`}>{probe.state}</dd><dd className="break-words text-xs text-muted-foreground">{probe.detail}</dd></div>)}
      </dl>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground"><span>Pending: {health.data.pending ?? "BLOCKED"}</span><span>Failed / perlu rekonsiliasi: {health.data.failed ?? "BLOCKED"}</span><span>Terakhir berhasil: {health.data.lastSuccess ? new Date(health.data.lastSuccess).toLocaleString("id-ID") : "—"}</span></div>
      <p className="mt-3 text-xs text-muted-foreground">Diperiksa: {new Date(health.data.checkedAt).toLocaleString("id-ID")}</p>
    </>}
  </section>;
}
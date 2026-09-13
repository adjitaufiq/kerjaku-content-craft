import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Library } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPerformanceInsight } from "@/lib/performance.functions";
import type { InsightGroup } from "@/lib/performance-insight";

export const Route = createFileRoute("/_authenticated/performance")({
  head: () => ({
    meta: [
      { title: "Performance Insight — KERJAKU Cliper Intelligence" },
      {
        name: "description",
        content:
          "Bandingkan performa konten KERJAKU terhadap baseline akun berdasarkan hook, CTA, dan mode ATM.",
      },
      { property: "og:title", content: "Performance Insight — KERJAKU Cliper Intelligence" },
      {
        property: "og:description",
        content: "Insight performa konten dengan minimal lima sampel sebelum kesimpulan ditarik.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PerformancePage,
});

function GroupTable({ title, groups }: { title: string; groups: InsightGroup[] }) {
  if (groups.length === 0) return null;
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <div className="mt-3 space-y-2">
        {groups.map((group) => (
          <div key={group.label} className="rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{group.label}</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{group.sample_size} konten</Badge>
                <Badge variant={group.performance_index >= 1 ? "default" : "secondary"}>
                  {group.performance_index}x baseline
                </Badge>
              </div>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Rata-rata {group.avg_views} views · ER {group.avg_engagement_rate}%
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{group.insight}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PerformancePage() {
  const load = useServerFn(getPerformanceInsight);
  const query = useQuery({ queryKey: ["performance-insight"], queryFn: () => load({}) });
  const insight = query.data;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold">Performance Insight</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Sistem hanya merangkum data. Tidak ada perubahan otomatis pada konten maupun aturan — keputusan
              tetap di tangan Anda.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/library">
              <Library /> Content Library
            </Link>
          </Button>
        </div>

        {query.isLoading ? (
          <p className="text-sm text-muted-foreground">Memuat…</p>
        ) : !insight ? (
          <p className="text-sm text-muted-foreground">Data belum tersedia.</p>
        ) : (
          <>
            <section className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={insight.status === "ready" ? "default" : "secondary"}>
                  {insight.status === "ready" ? "Insight siap" : "Insufficient data"}
                </Badge>
                <Badge variant="outline">{insight.sample_size} konten terukur</Badge>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{insight.message}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Baseline views</p>
                  <p className="text-xl font-semibold">{insight.baseline.avg_views}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Baseline engagement rate</p>
                  <p className="text-xl font-semibold">{insight.baseline.avg_engagement_rate}%</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Sample baseline</p>
                  <p className="text-xl font-semibold">{insight.baseline.sample_size}</p>
                </div>
              </div>
            </section>

            {insight.topContent.length > 0 ? (
              <section className="rounded-xl border border-border bg-card p-5">
                <h2 className="font-display text-lg font-semibold">Konten Terbaik</h2>
                <ol className="mt-3 space-y-2">
                  {insight.topContent.map((item) => (
                    <li
                      key={item.content_id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"
                    >
                      <span className="font-medium">{item.title}</span>
                      <span className="text-sm text-muted-foreground">
                        {item.views} views · {item.performance_index}x baseline
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            <GroupTable title="Berdasarkan Hook" groups={insight.byHook} />
            <GroupTable title="Berdasarkan CTA" groups={insight.byCta} />
            <GroupTable title="Berdasarkan Mode ATM" groups={insight.byFormat} />
          </>
        )}
      </div>
    </AppShell>
  );
}

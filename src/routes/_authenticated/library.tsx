import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3, Library, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getLibraryFacets, listContentLibrary, type LibraryFilters } from "@/lib/content-library.functions";
import { recordPerformance, type MeasurementPeriod } from "@/lib/performance.functions";

export const Route = createFileRoute("/_authenticated/library")({
  head: () => ({
    meta: [
      { title: "Content Library — KERJAKU Cliper Intelligence" },
      {
        name: "description",
        content:
          "Arsip intelligence setiap konten KERJAKU: sumber, viral DNA, aset produksi, skor mutu, dan performa.",
      },
      { property: "og:title", content: "Content Library — KERJAKU Cliper Intelligence" },
      {
        property: "og:description",
        content: "Filter konten berdasarkan kategori, tipe hook, mode ATM, dan status pengukuran performa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContentLibraryPage,
});

const PERIODS: MeasurementPeriod[] = ["24h", "7d", "30d"];

function MetricForm({ contentId, onSaved }: { contentId: string; onSaved: () => void }) {
  const save = useServerFn(recordPerformance);
  const [period, setPeriod] = useState<MeasurementPeriod>("24h");
  const [values, setValues] = useState({ views: "", likes: "", comments: "", shares: "", saves: "" });

  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          contentId,
          period,
          views: Number(values.views || 0),
          likes: Number(values.likes || 0),
          comments: Number(values.comments || 0),
          shares: Number(values.shares || 0),
          saves: Number(values.saves || 0),
        },
      }),
    onSuccess: () => {
      toast.success("Metrik tersimpan.");
      onSaved();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="rounded-md border border-input bg-background px-2 py-1 text-xs"
          value={period}
          onChange={(event) => setPeriod(event.target.value as MeasurementPeriod)}
          aria-label="Periode pengukuran"
        >
          {PERIODS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        {(["views", "likes", "comments", "shares", "saves"] as const).map((field) => (
          <Input
            key={field}
            className="h-8 w-24 text-xs"
            inputMode="numeric"
            placeholder={field}
            value={values[field]}
            onChange={(event) => setValues((prev) => ({ ...prev, [field]: event.target.value }))}
          />
        ))}
        <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
          Simpan Metrik
        </Button>
      </div>
    </div>
  );
}

function ContentLibraryPage() {
  const queryClient = useQueryClient();
  const list = useServerFn(listContentLibrary);
  const facetsFn = useServerFn(getLibraryFacets);
  const [filters, setFilters] = useState<LibraryFilters>({ atmMode: "all", performance: "all" });

  const facets = useQuery({ queryKey: ["library-facets"], queryFn: () => facetsFn({}) });
  const items = useQuery({
    queryKey: ["content-library", filters],
    queryFn: () => list({ data: filters }),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["content-library"] });
    void queryClient.invalidateQueries({ queryKey: ["performance-insight"] });
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold">Content Library</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Setiap konten tersimpan lengkap dengan sumber, viral DNA, aset, skor mutu, dan performanya.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/performance">
              <BarChart3 /> Performance Insight
            </Link>
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-card p-4">
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={filters.category ?? ""}
            onChange={(event) => setFilters((prev) => ({ ...prev, category: event.target.value || undefined }))}
            aria-label="Kategori"
          >
            <option value="">Semua kategori</option>
            {(facets.data?.categories ?? []).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={filters.hookType ?? ""}
            onChange={(event) => setFilters((prev) => ({ ...prev, hookType: event.target.value || undefined }))}
            aria-label="Tipe hook"
          >
            <option value="">Semua hook</option>
            {(facets.data?.hookTypes ?? []).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={filters.atmMode ?? "all"}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, atmMode: event.target.value as LibraryFilters["atmMode"] }))
            }
            aria-label="Mode ATM"
          >
            <option value="all">Semua mode</option>
            <option value="conservative">conservative</option>
            <option value="creative">creative</option>
          </select>
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={filters.performance ?? "all"}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, performance: event.target.value as LibraryFilters["performance"] }))
            }
            aria-label="Status performa"
          >
            <option value="all">Semua performa</option>
            <option value="measured">Sudah diukur</option>
            <option value="unmeasured">Belum diukur</option>
          </select>
        </div>

        {items.isLoading ? (
          <p className="text-sm text-muted-foreground">Memuat…</p>
        ) : (items.data ?? []).length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center">
            <Library className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Belum ada konten tersimpan. Jalankan Quality Gate pada sebuah versi KERJAKU.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {(items.data ?? []).map((item) => (
              <article key={item.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-base font-semibold">{item.title}</h2>
                  <Badge variant="outline">{item.atm_mode}</Badge>
                  {item.hook_type ? <Badge variant="outline">{item.hook_type}</Badge> : null}
                  {item.category ? <Badge variant="outline">{item.category}</Badge> : null}
                  <Badge variant={item.approval_status === "published" ? "default" : "secondary"}>
                    {item.approval_status}
                  </Badge>
                  {typeof item.quality_result?.overall_score === "number" ? (
                    <Badge variant="outline">Skor {item.quality_result.overall_score}</Badge>
                  ) : null}
                </div>
                {item.override_note ? (
                  <p className="mt-2 text-sm text-muted-foreground">Catatan: {item.override_note}</p>
                ) : null}
                {item.performance.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {item.performance.map((entry) => (
                      <span key={entry.period} className="rounded-md border border-border px-2 py-1">
                        {entry.period}: {entry.views} views · ER {entry.engagement_rate}%
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">Belum ada metrik performa.</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link to="/quality" search={{ versionId: item.version_id }}>
                      Quality Gate
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <Link to="/production" search={{ versionId: item.version_id }}>
                      Aset Produksi
                    </Link>
                  </Button>
                </div>
                <MetricForm contentId={item.id} onSaved={refresh} />
              </article>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

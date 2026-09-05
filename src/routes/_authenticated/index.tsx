import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, FileEdit, ImageIcon } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { fetchBank, fetchLogs, indexLogs, statusTone } from "@/lib/content-data";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Content Grid — KERJAKU Instagram Publisher" },
      {
        name: "description",
        content:
          "Pantau 30 konten Instagram @kerjaku.space: status draft, terjadwal, dan sudah tayang dalam satu grid.",
      },
      { property: "og:title", content: "Content Grid — KERJAKU Instagram Publisher" },
      {
        property: "og:description",
        content: "Kelola bank konten, jadwal, dan publikasi Instagram KERJAKU dari satu dashboard.",
      },
    ],
  }),
  component: GridPage,
});

function GridPage() {
  const bank = useQuery({ queryKey: ["bank"], queryFn: fetchBank });
  const logs = useQuery({ queryKey: ["logs"], queryFn: fetchLogs });

  const logMap = indexLogs(logs.data ?? []);
  const rows = bank.data ?? [];

  const counts = {
    published: rows.filter((r) => logMap.get(r.no)?.status === "published").length,
    scheduled: rows.filter((r) => logMap.get(r.no)?.status === "scheduled").length,
    draft: rows.filter((r) => (logMap.get(r.no)?.status ?? "draft") === "draft").length,
  };

  return (
    <AppShell>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Content Grid</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bank konten 1–30 untuk feed @kerjaku.space.
          </p>
        </div>
        <div className="flex gap-2">
          <Stat icon={CheckCircle2} label="Published" value={counts.published} />
          <Stat icon={CalendarClock} label="Scheduled" value={counts.scheduled} />
          <Stat icon={FileEdit} label="Draft" value={counts.draft} />
        </div>
      </div>

      {bank.isLoading ? (
        <p className="text-sm text-muted-foreground">Memuat bank konten…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((row) => {
            const log = logMap.get(row.no);
            const status = log?.status ?? "draft";
            const photoCount = log ? imagesOf(log).length : 0;
            return (
              <Link
                key={row.no}
                to="/editor"
                search={{ no: row.no }}
                className="surface-panel group overflow-hidden transition-all hover:border-primary/50 hover:glow-ring"
              >
                <div className="relative aspect-4/5 overflow-hidden bg-secondary/60">
                  {log?.image_url ? (
                    <img
                      src={log.image_url}
                      alt={`Preview konten ${row.no}`}
                      loading="lazy"
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
                      <ImageIcon className="size-7" />
                      <span className="text-xs">Belum ada foto</span>
                    </div>
                  )}
                  <span className="absolute left-3 top-3 rounded-lg bg-background/85 px-2 py-1 font-display text-xs font-bold text-primary">
                    #{row.no}
                  </span>
                  {photoCount > 1 ? (
                    <span className="absolute bottom-3 right-3 flex items-center gap-1 rounded-lg bg-background/85 px-2 py-1 text-[11px] font-medium">
                      <Layers className="size-3.5" />
                      {photoCount}
                    </span>
                  ) : null}
                  <Badge
                    variant="outline"
                    className={`absolute right-3 top-3 capitalize ${statusTone(status)}`}
                  >
                    {status}
                  </Badge>
                </div>
                <div className="p-4">
                  <h2 className="line-clamp-2 text-sm font-semibold">{row.title}</h2>
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{row.caption}</p>
                  {log?.scheduled_at ? (
                    <p className="mt-3 flex items-center gap-1.5 text-[11px] text-primary">
                      <CalendarClock className="size-3.5" />
                      {new Date(log.scheduled_at).toLocaleString("id-ID")}
                    </p>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: number;
}) {
  return (
    <div className="surface-panel flex items-center gap-3 px-4 py-3">
      <Icon className="size-4 text-primary" />
      <div>
        <p className="font-display text-lg font-bold leading-none">{value}</p>
        <p className="text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

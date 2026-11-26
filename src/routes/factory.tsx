import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Factory,
  BookOpen,
  Plus,
  CalendarClock,
  Layers,
  AlertCircle,
  RefreshCw,
  SlidersHorizontal,
  Activity,
  Play,
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ContentBankStudio } from "@/components/ContentBankStudio";
import { FactoryResultGallery } from "@/components/FactoryResultGallery";
import { supabase } from "@/integrations/supabase/client";
import { contentSchema, type BankContent } from "@/lib/content-bank";
import { campaignSchema } from "@/lib/factory-types";
import { createFactoryCampaign, loadFactory, saveFactoryBank } from "@/lib/factory.functions";

export const Route = createFileRoute("/factory")({
  head: () => ({
    meta: [
      { title: "Content Factory — Hasil Konten KERJAKU" },
      {
        name: "description",
        content:
          "Buat campaign dan kelola hasil video, carousel, poster, caption serta distribusi KERJAKU dalam satu tempat.",
      },
      { property: "og:title", content: "Content Factory — Hasil Konten KERJAKU" },
      {
        property: "og:description",
        content:
          "Satu campaign untuk video, carousel dan poster dengan hasil siap ditinjau dan diunduh.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FactoryPage,
});

const stageLabels: Record<string, string> = {
  research: "Riset",
  script: "Naskah",
  image: "Visual",
  design: "Poster & carousel",
  voice: "Narasi",
  render: "Video",
  quality: "Pemeriksaan",
  distribution: "Distribusi",
  analytics: "Statistik",
  complete: "Selesai",
};
const stateLabels: Record<string, string> = {
  queued: "Dalam antrean",
  pending: "Dalam antrean",
  running: "Dikerjakan",
  blocked: "Terhenti",
  reconciliation_required: "Perlu diperiksa",
  complete: "Selesai",
  completed: "Selesai",
  ready: "Siap",
  awaiting_authorization: "Menunggu izin",
  unsupported_format: "Format tidak didukung",
  published: "Dipublikasikan",
};

function FactoryPage() {
  const [tab, setTab] = useState("results");
  const [drafts, setDrafts] = useState<BankContent[]>([]);
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [compose, setCompose] = useState(false);
  const [operations, setOperations] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [command, setCommand] = useState(
    "Konten edukasi AI Automation untuk pemilik bisnis, dengan contoh praktis dan ajakan berdiskusi.",
  );
  const [count, setCount] = useState(3);
  const [audience, setAudience] = useState("Pemilik bisnis Indonesia");
  const [platforms, setPlatforms] = useState(["tiktok", "instagram"]);
  const [duration, setDuration] = useState(45);
  const [slides, setSlides] = useState(7);
  const [formats, setFormats] = useState<BankContent["production"]["format"][]>([
    "Foto",
    "Carousel",
    "Video",
  ]);
  const [busy, setBusy] = useState(false);
  const [sources, setSources] = useState<BankContent[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(0);
  const fetchFactory = useServerFn(loadFactory);
  const saveBank = useServerFn(saveFactoryBank);
  const createCampaign = useServerFn(createFactoryCampaign);
  const qc = useQueryClient();
  const cloud = useQuery({
    queryKey: ["factory", userId],
    queryFn: () => fetchFactory({}),
    enabled: Boolean(userId),
    retry: false,
    refetchInterval: userId ? 15000 : false,
  });
  useEffect(() => {
    let active = true;
    async function init() {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      const id = data.session?.user.id ?? null;
      setUserId(id);
      try {
        const value = localStorage.getItem(`craft-drafts:${id ?? "offline"}`);
        setDrafts(value ? JSON.parse(value).map((r: unknown) => contentSchema.parse(r)) : []);
      } catch {
        toast.error("Draf perangkat tidak dapat dibaca; salinan lama tidak ditimpa.");
      }
      setReady(true);
    }
    void init();
    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      void init();
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    setPage(0);
  }, [search, filter]);
  function updateDrafts(rows: BankContent[]) {
    try {
      localStorage.setItem(`craft-drafts:${userId ?? "offline"}`, JSON.stringify(rows));
      setDrafts(rows);
    } catch {
      toast.error("Penyimpanan perangkat penuh. Ekspor Excel sebelum melanjutkan.");
    }
  }
  async function sync(rows: BankContent[]) {
    if (!userId) {
      toast.error("Login diperlukan untuk menyimpan konten. Draf perangkat tetap tersedia.");
      return;
    }
    setBusy(true);
    try {
      await saveBank({ data: rows });
      await qc.invalidateQueries({ queryKey: ["factory"] });
      toast.success("Konten tersimpan.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Penyimpanan belum tersedia");
    } finally {
      setBusy(false);
    }
  }
  async function startCampaign() {
    if (!userId) {
      toast.error("Login dahulu; tidak ada pekerjaan yang dimulai.");
      return;
    }
    setBusy(true);
    try {
      const input = campaignSchema.parse({
        command,
        count,
        audience,
        platforms,
        duration,
        slides,
        formats,
        mode: "economy",
        publishingMode: "manual",
        seedContents: sources,
      });
      await createCampaign({ data: input });
      await qc.invalidateQueries({ queryKey: ["factory"] });
      toast.success("Campaign masuk antrean. Hasil akan muncul setelah produksi selesai.");
      setSources([]);
      setCompose(false);
      setTab("results");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Campaign belum dapat dibuat.");
    } finally {
      setBusy(false);
    }
  }
  const stored = cloud.data?.bank ?? [];
  const combined = [...drafts, ...stored.filter((r) => !drafts.some((d) => d.id === r.id))];
  const results = cloud.data?.results ?? [];
  const filtered = results.filter(
    (r) =>
      r.title.toLocaleLowerCase("id").includes(search.toLocaleLowerCase("id")) &&
      (filter === "all" || filter === r.status),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 12));
  const currentPage = Math.min(page, pages - 1);
  const readyCount = results.filter((r) => r.status === "ready").length;
  const processingCount = results.filter(
    (r) => r.status === "processing" || r.status === "review",
  ).length;
  const blockedCount = results.filter((r) => r.status === "blocked").length;
  function openCompose() {
    setCompose(true);
  }
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Factory className="size-6 shrink-0 text-primary" />
            <div>
              <p className="text-xs font-medium text-muted-foreground">KERJAKU</p>
              <p className="font-display text-lg font-semibold">Content Factory</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              title="Status operasional"
              aria-label="Status operasional"
              onClick={() => setOperations(true)}
            >
              <Activity className="size-4" />
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/">Publisher</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/auth">{userId ? "Akun" : "Login"}</Link>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Konten kamu</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {readyCount} siap unduh · {processingCount} sedang dibuat
              {blockedCount > 0 ? ` · ${blockedCount} perlu perhatian` : ""}
            </p>
          </div>
          <Button onClick={openCompose}>
            <Plus className="size-4" />
            Buat konten
          </Button>
        </div>
        {(cloud.error || (ready && !userId)) && (
          <div
            role="status"
            className="mb-6 flex items-center gap-3 border-l-2 border-primary bg-muted px-4 py-3"
          >
            <AlertCircle className="size-4 shrink-0 text-primary" />
            <p className="text-sm">
              {userId
                ? "Penyimpanan campaign belum siap. Draf dan Excel tetap tersedia."
                : "Login untuk membuat campaign dan menyimpan hasil konten."}
            </p>
            {userId && (
              <Button
                size="icon"
                variant="ghost"
                title="Coba sambungkan lagi"
                aria-label="Coba sambungkan lagi"
                onClick={() => void cloud.refetch()}
              >
                <RefreshCw className="size-4" />
              </Button>
            )}
          </div>
        )}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6 grid h-11 w-full grid-cols-3 sm:w-fit">
            <TabsTrigger value="results" className="gap-2 sm:px-6">
              <Layers className="size-4" />
              Hasil
            </TabsTrigger>
            <TabsTrigger value="bank" className="gap-2 sm:px-6">
              <BookOpen className="size-4" />
              Bank konten
            </TabsTrigger>
            <TabsTrigger value="distribution" className="gap-2 sm:px-6">
              <CalendarClock className="size-4" />
              Distribusi
            </TabsTrigger>
          </TabsList>
          <TabsContent value="results" className="space-y-5">
            <div className="flex flex-wrap gap-3">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
                <Input
                  aria-label="Cari hasil konten"
                  placeholder="Cari konten…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger aria-label="Filter hasil" className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua hasil</SelectItem>
                  <SelectItem value="ready">Siap unduh</SelectItem>
                  <SelectItem value="processing">Sedang dibuat</SelectItem>
                  <SelectItem value="review">Pemeriksaan</SelectItem>
                  <SelectItem value="blocked">Perlu perhatian</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {cloud.isPending && userId ? (
              <p className="py-16 text-center text-muted-foreground">Memuat hasil konten…</p>
            ) : filtered.length === 0 && results.length > 0 ? (
              <p className="py-16 text-center text-muted-foreground">
                Tidak ada hasil yang sesuai.
              </p>
            ) : (
              <FactoryResultGallery
                results={filtered.slice(currentPage * 12, currentPage * 12 + 12)}
                onCreate={openCompose}
              />
            )}
            {pages > 1 && (
              <div className="flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Halaman sebelumnya"
                  disabled={currentPage === 0}
                  onClick={() => setPage((n) => n - 1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="text-sm">
                  {currentPage + 1} / {pages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Halaman berikutnya"
                  disabled={currentPage >= pages - 1}
                  onClick={() => setPage((n) => n + 1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )}
            {cloud.data?.analytics && (
              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-5 text-sm text-muted-foreground">
                <Activity className="size-4" />
                {cloud.data.analytics.available
                  ? `${cloud.data.analytics.measuredPosts} posting memiliki statistik terukur`
                  : "Statistik belum tersedia"}
                {cloud.data.analytics.recommendations.map((r) => (
                  <Button
                    key={r.sourceContentId}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCommand(r.nextCommand);
                      openCompose();
                    }}
                  >
                    Buat variasi berikutnya
                  </Button>
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="bank">
            {ready ? (
              <ContentBankStudio
                drafts={combined}
                onChange={updateDrafts}
                onSync={sync}
                saving={busy}
                onProduce={(rows) => {
                  setSources(rows);
                  setCommand(
                    `Produksi ${rows.length} konten KERJAKU: ${rows.map((r) => r.title).join("; ")}`,
                  );
                  setCount(rows.length);
                  openCompose();
                }}
              />
            ) : (
              <p className="text-muted-foreground">Memuat bank konten…</p>
            )}
          </TabsContent>
          <TabsContent value="distribution" className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Antrean publikasi</h2>
              <Badge variant="outline">{cloud.data?.distribution.length ?? 0} paket</Badge>
            </div>
            {!cloud.data?.distribution.length && (
              <div className="border-y border-border py-16 text-center">
                <CalendarClock className="mx-auto mb-3 size-8 text-muted-foreground" />
                <h3 className="font-medium">Belum ada paket publikasi</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Posting otomatis belum diaktifkan.
                </p>
              </div>
            )}
            <div className="divide-y divide-border">
              {cloud.data?.distribution.map((item) => (
                <article
                  key={item.id}
                  className="flex flex-wrap items-start justify-between gap-3 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words font-medium">{item.package.title}</h3>
                    <p className="mt-1 text-xs capitalize text-muted-foreground">
                      {item.platform} · {item.format}
                      {item.available_at
                        ? ` · ${new Date(item.available_at).toLocaleString("id-ID")}`
                        : ""}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">{item.reason}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant="outline">
                      {stateLabels[item.state] ?? "Menunggu pemeriksaan"}
                    </Badge>
                    {item.post_url && (
                      <Button asChild size="sm" variant="outline">
                        <a href={item.post_url} target="_blank" rel="noopener noreferrer">
                          Buka posting
                        </a>
                      </Button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>
      <Dialog
        open={compose}
        onOpenChange={(open) => {
          if (!busy) setCompose(open);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Buat konten</DialogTitle>
            <DialogDescription>
              Campaign baru · Hasil untuk ditinjau, tanpa posting otomatis
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              void startCampaign();
            }}
          >
            {sources.length > 0 && (
              <Badge variant="secondary">{sources.length} konten dari bank</Badge>
            )}
            <div className="space-y-2">
              <Label htmlFor="command">Topik atau brief</Label>
              <Textarea
                id="command"
                aria-label="Campaign command"
                rows={3}
                minLength={10}
                maxLength={3000}
                required
                value={command}
                onChange={(e) => setCommand(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              {(["Foto", "Carousel", "Video"] as const).map((format) => (
                <label key={format} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={formats.includes(format)}
                    onCheckedChange={(checked) =>
                      setFormats((current) =>
                        checked
                          ? [...current.filter((f) => f !== format), format]
                          : current.filter((f) => f !== format),
                      )
                    }
                  />
                  {format === "Foto" ? "Poster" : format}
                </label>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="count">Jumlah konsep</Label>
                <Input
                  id="count"
                  type="number"
                  min={1}
                  max={100}
                  required
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slides">Slide carousel</Label>
                <Select
                  value={String(slides)}
                  onValueChange={(v) => setSlides(Number(v))}
                  disabled={!formats.includes("Carousel")}
                >
                  <SelectTrigger id="slides">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[5, 7, 10].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} slide
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="px-0 text-muted-foreground"
              onClick={() => setAdvanced((v) => !v)}
              aria-expanded={advanced}
            >
              <SlidersHorizontal className="size-4" />
              Pengaturan tambahan
            </Button>
            {advanced && (
              <div className="space-y-4 border-t border-border pt-4">
                <div className="space-y-2">
                  <Label htmlFor="audience">Target audiens</Label>
                  <Input
                    id="audience"
                    required
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration">Durasi video (detik)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min={10}
                    max={3600}
                    required
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                  />
                </div>
                <div className="flex flex-wrap gap-4">
                  {["instagram", "tiktok", "facebook", "youtube"].map((p) => (
                    <label key={p} className="flex items-center gap-2 text-sm capitalize">
                      <Checkbox
                        checked={platforms.includes(p)}
                        onCheckedChange={(checked) =>
                          setPlatforms((current) =>
                            checked
                              ? [...current.filter((v) => v !== p), p]
                              : current.filter((v) => v !== p),
                          )
                        }
                      />
                      {p}
                    </label>
                  ))}
                </div>
              </div>
            )}
            {Boolean(cloud.error) && (
              <p className="text-sm text-destructive">
                Penyimpanan campaign belum siap. Produksi tidak dapat dimulai.
              </p>
            )}
            {!userId && (
              <p className="text-sm text-muted-foreground">
                Login diperlukan untuk memulai campaign.
              </p>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={
                busy ||
                !userId ||
                Boolean(cloud.error) ||
                cloud.isPending ||
                command.trim().length < 10 ||
                !platforms.length ||
                !formats.length
              }
            >
              <Play className="size-4" />
              {busy ? "Memasukkan ke antrean…" : "Mulai produksi"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={operations} onOpenChange={setOperations}>
        <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Status operasional</DialogTitle>
            <DialogDescription>Detail pekerjaan dan kendala produksi</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between border-b border-border pb-3">
            <span className="text-sm">Penyimpanan campaign</span>
            <Badge variant="outline">
              {cloud.data ? "Terhubung" : userId ? "Belum tersedia" : "Belum login"}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Segarkan status"
              disabled={!userId}
              onClick={() => void cloud.refetch()}
            >
              <RefreshCw className="size-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Pekerja video dan suara alami belum terverifikasi. Posting otomatis belum diaktifkan.
          </p>
          {!cloud.data?.campaigns.length && (
            <p className="text-sm text-muted-foreground">Belum ada campaign yang dapat dibaca.</p>
          )}
          {cloud.data?.campaigns.map((c) => (
            <section key={c.id} className="space-y-3 border-t border-border pt-4">
              <h3 className="break-words font-medium">{c.command}</h3>
              <p className="text-xs text-muted-foreground">
                {new Date(c.created_at).toLocaleString("id-ID")} · {c.tasks.length} konsep
              </p>
              {c.tasks.map((t) => (
                <div key={t.id} className="space-y-1">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span>
                      #{t.ordinal} · {stageLabels[t.stage] ?? t.stage}
                    </span>
                    <span
                      className={
                        t.state === "blocked" ? "text-destructive" : "text-muted-foreground"
                      }
                    >
                      {t.stage === "complete" ? (
                        <CheckCircle2 className="size-4 text-accent" />
                      ) : (
                        (stateLabels[t.state] ?? t.state)
                      )}
                    </span>
                  </div>
                  {t.error && <p className="break-words text-xs text-destructive">{t.error}</p>}
                </div>
              ))}
            </section>
          ))}
        </DialogContent>
      </Dialog>
    </div>
  );
}

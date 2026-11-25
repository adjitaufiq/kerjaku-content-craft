import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Factory,
  BookOpen,
  Play,
  CalendarClock,
  ImageIcon,
  AlertCircle,
  ArrowRight,
  Download,
  RefreshCw,
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
import { ContentBankStudio } from "@/components/ContentBankStudio";
import { FactoryProductionProof } from "@/components/FactoryProductionProof";
import { supabase } from "@/integrations/supabase/client";
import { contentSchema, type BankContent } from "@/lib/content-bank";
import { FACTORY_STAGES, campaignSchema } from "@/lib/factory-types";
import {
  createFactoryCampaign,
  loadFactory,
  saveFactoryBank,
  getFactoryAsset,
} from "@/lib/factory.functions";

export const Route = createFileRoute("/factory")({
  head: () => ({
    meta: [
      { title: "Production Studio — KERJAKU Content Factory" },
      {
        name: "description",
        content:
          "Bank konten dua sheet Excel dan workflow campaign KERJAKU dari riset hingga produksi dan distribusi.",
      },
      { property: "og:title", content: "Production Studio — KERJAKU Content Factory" },
      {
        property: "og:description",
        content:
          "Kelola template, script, campaign, media dan antrean publikasi dalam satu studio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FactoryPage,
});

function FactoryPage() {
  const [tab, setTab] = useState("bank");
  const [drafts, setDrafts] = useState<BankContent[]>([]);
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [command, setCommand] = useState("10 Konten Edukasi AI Automation untuk KERJAKU");
  const [count, setCount] = useState(10);
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
  const fetchFactory = useServerFn(loadFactory);
  const saveBank = useServerFn(saveFactoryBank);
  const createCampaign = useServerFn(createFactoryCampaign);
  const signAsset = useServerFn(getFactoryAsset);
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
        if (value) setDrafts(JSON.parse(value).map((r: unknown) => contentSchema.parse(r)));
      } catch {
        toast.error("Draf perangkat tidak dapat dibaca; salinan lama tidak ditimpa.");
      }
      setReady(true);
    }
    void init();
    return () => {
      active = false;
    };
  }, []);
  function updateDrafts(rows: BankContent[]) {
    try {
      localStorage.setItem(`craft-drafts:${userId ?? "offline"}`, JSON.stringify(rows));
      setDrafts(rows);
    } catch {
      toast.error("Penyimpanan perangkat penuh. Export Excel sebelum melanjutkan.");
    }
  }
  async function sync(rows: BankContent[]) {
    if (!userId) {
      toast.error(
        "Draf tersedia di perangkat; login dan Lovable Cloud aktif diperlukan untuk penyimpanan bersama campaign.",
      );
      return;
    }
    setBusy(true);
    try {
      await saveBank({ data: rows });
      await qc.invalidateQueries({ queryKey: ["factory"] });
      toast.success("Konten tersimpan di Cloud.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Penyimpanan belum tersedia");
    } finally {
      setBusy(false);
    }
  }
  async function startCampaign() {
    if (!userId) {
      toast.error(
        "Campaign memerlukan login dan Lovable Cloud aktif; tidak ada pekerjaan yang dimulai.",
      );
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
      const result = await createCampaign({ data: input });
      await qc.invalidateQueries({ queryKey: ["factory"] });
      toast.success(`Campaign ${result.id.slice(0, 8)} masuk antrean.`);
      setSources([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Campaign gagal");
    } finally {
      setBusy(false);
    }
  }
  const stageLabels: Record<string, string> = {
    research: "Riset",
    script: "Script",
    image: "Gambar",
    design: "Poster & Carousel",
    voice: "Voice-over",
    render: "Video",
    quality: "QC",
    distribution: "Distribusi",
    analytics: "Analytics",
  };
  const stored = cloud.data?.bank ?? [];
  const combined = [...drafts, ...stored.filter((r) => !drafts.some((d) => d.id === r.id))];
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Factory className="size-7 text-primary" />
            <div>
              <div className="font-display text-lg font-semibold">
                KERJAKU <span className="text-primary">Content Factory</span>
              </div>
              <div className="text-xs text-muted-foreground">Production Studio</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline">{cloud.data ? "Cloud terhubung" : "Draf perangkat"}</Badge>
            <Link to="/" className="text-sm text-muted-foreground">
              Publisher
            </Link>
            <Link to="/auth" className="text-sm text-primary">
              {userId ? "Akun" : "Login"}
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase text-accent">Satu workflow produksi</p>
            <h1 className="mt-2 text-3xl font-semibold">Dari ide ke konten nyata.</h1>
          </div>
          <div className="flex gap-5">
            <div>
              <strong className="font-display text-xl">{combined.length}</strong>
              <p className="text-xs text-muted-foreground">Konten pribadi</p>
            </div>
            <div>
              <strong className="font-display text-xl">{cloud.data?.campaigns.length ?? 0}</strong>
              <p className="text-xs text-muted-foreground">Campaign</p>
            </div>
            <div>
              <strong className="font-display text-xl">{cloud.data?.media.length ?? 0}</strong>
              <p className="text-xs text-muted-foreground">Media tersimpan</p>
            </div>
          </div>
        </div>
        {!cloud.data && (
          <div
            role="status"
            className="flex items-start gap-3 border-l-2 border-primary bg-primary/5 px-4 py-3"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="text-sm">
              <div className="font-medium">Produksi otomatis belum terverifikasi</div>
              <p className="mt-1 text-xs text-muted-foreground">
                {cloud.error
                  ? "Penyimpanan campaign belum dapat diakses. Draf dan Excel di perangkat tetap tersedia."
                  : "Riset, media dan publikasi menunggu Lovable Cloud aktif, pekerja media, dan akun platform terotorisasi."}
              </p>
            </div>
          </div>
        )}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-auto w-full justify-start overflow-x-auto bg-transparent p-0">
            <TabsTrigger value="bank" className="gap-2 py-3">
              <BookOpen className="size-4" />
              Content Bank
            </TabsTrigger>
            <TabsTrigger value="campaign" className="gap-2 py-3">
              <Play className="size-4" />
              Campaign
            </TabsTrigger>
            <TabsTrigger value="library" className="gap-2 py-3">
              <ImageIcon className="size-4" />
              Content Library
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-2 py-3">
              <CalendarClock className="size-4" />
              Calendar & Distribusi
            </TabsTrigger>
          </TabsList>
          <TabsContent value="bank" className="mt-6">
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
                  setTab("campaign");
                }}
              />
            ) : (
              <p className="text-muted-foreground">Memuat Content Bank…</p>
            )}
          </TabsContent>
          <TabsContent value="campaign" className="mt-6 space-y-7">
            <section className="space-y-4 border-b border-border pb-6">
              <h2 className="font-display text-xl font-semibold">Campaign command</h2>
              {sources.length > 0 && (
                <div className="flex gap-2 text-sm text-accent">
                  <ArrowRight className="size-4 shrink-0" />
                  {sources.length} naskah dari Content Bank
                </div>
              )}
              <Textarea
                aria-label="Campaign command"
                rows={3}
                value={command}
                onChange={(e) => setCommand(e.target.value)}
              />
              <div className="grid gap-4 sm:grid-cols-[1fr_120px_140px]">
                <div>
                  <Label htmlFor="audience">Target audiens</Label>
                  <Input
                    id="audience"
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="count">Jumlah konten</Label>
                  <Input
                    id="count"
                    type="number"
                    min={1}
                    max={100}
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="duration">Durasi (detik)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min={10}
                    max={3600}
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-6">
                <div className="flex flex-wrap gap-4">
                  {(["Foto", "Carousel", "Video"] as const).map((format) => (
                    <label key={format} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={formats.includes(format)}
                        onCheckedChange={(checked) =>
                          setFormats(
                            checked ? [...formats, format] : formats.filter((f) => f !== format),
                          )
                        }
                      />
                      {format === "Foto"
                        ? "Poster PNG/JPG"
                        : format === "Video"
                          ? "Video MP4 + VO"
                          : "Carousel"}
                    </label>
                  ))}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slides">Slide carousel</Label>
                  <Select
                    value={String(slides)}
                    onValueChange={(value) => setSlides(Number(value))}
                  >
                    <SelectTrigger id="slides" className="w-32">
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
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap gap-4">
                  {["instagram", "tiktok", "facebook", "youtube"].map((p) => (
                    <label key={p} className="flex items-center gap-2 text-sm capitalize">
                      <input
                        type="checkbox"
                        checked={platforms.includes(p)}
                        onChange={(e) =>
                          setPlatforms(
                            e.target.checked ? [...platforms, p] : platforms.filter((v) => v !== p),
                          )
                        }
                      />
                      {p}
                    </label>
                  ))}
                </div>
                <Button
                  disabled={busy || !command.trim() || !platforms.length || !formats.length}
                  onClick={() => void startCampaign()}
                >
                  <Play className="size-4" />
                  {busy ? "Membuat campaign…" : "Mulai campaign"}
                </Button>
              </div>
            </section>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">Antrean produksi</h2>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Segarkan campaign"
                disabled={!userId}
                onClick={() => void cloud.refetch()}
              >
                <RefreshCw className="size-4" />
              </Button>
            </div>
            {!cloud.data?.campaigns.length && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Belum ada campaign tersimpan.
              </p>
            )}
            {cloud.data?.campaigns.map((c) => (
              <section key={c.id} className="space-y-4 border-b border-border pb-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{c.command.split("\n")[0]}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {c.id} · {new Date(c.created_at).toLocaleString("id-ID")}
                    </p>
                  </div>
                  <Badge variant="outline">{c.state}</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {FACTORY_STAGES.filter((s) => s !== "analytics").map((s) => (
                    <span key={s} className="border-b border-border px-2 py-2 text-xs">
                      {stageLabels[s]}{" "}
                      <strong className="ml-1 text-primary">
                        {
                          c.tasks.filter(
                            (t) =>
                              FACTORY_STAGES.indexOf(t.stage as (typeof FACTORY_STAGES)[number]) >
                                FACTORY_STAGES.indexOf(s) || t.stage === "complete",
                          ).length
                        }
                        /{c.tasks.length}
                      </strong>
                    </span>
                  ))}
                </div>
                {c.tasks.map((t) => (
                  <div key={t.id} className="flex flex-wrap gap-3 text-xs">
                    <span>#{t.ordinal}</span>
                    <span>{stageLabels[t.stage] ?? t.stage}</span>
                    <Badge variant="secondary">{t.state}</Badge>
                    {t.error && <span className="text-destructive">{t.error}</span>}
                  </div>
                ))}
              </section>
            ))}
          </TabsContent>
          <TabsContent value="library" className="mt-6">
            <h2 className="font-display text-xl font-semibold">Media hasil produksi</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cloud.data?.media.map((m) => (
                <article key={m.id} className="space-y-3 rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">{m.kind}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {Math.round(m.bytes / 1024)} KB
                    </span>
                  </div>
                  <p className="break-all text-xs text-muted-foreground">
                    {m.path.split("/").at(-1)}
                  </p>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        const result = await signAsset({ data: { id: m.id } });
                        const a = document.createElement("a");
                        a.href = result.url;
                        a.target = "_blank";
                        a.rel = "noopener";
                        a.click();
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Media belum tersedia");
                      }
                    }}
                  >
                    <Download className="size-4" />
                    Buka media
                  </Button>
                </article>
              ))}
            </div>
            {!cloud.data?.media.length && (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Belum ada media hasil produksi yang tersimpan.
              </p>
            )}
            <FactoryProductionProof />
          </TabsContent>
          <TabsContent value="calendar" className="mt-6 space-y-6">
            <h2 className="font-display text-xl font-semibold">Calendar & Distribusi</h2>
            {cloud.data?.distribution.map((item) => (
              <article key={item.id} className="space-y-2 border-b border-border py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">{item.package.title}</h3>
                  <Badge variant="outline">{item.state}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {item.platform} · {item.format} · {item.package.assets.length} aset
                </p>
                <p className="whitespace-pre-wrap text-sm">{item.package.caption}</p>
                <p className="text-xs text-muted-foreground">{item.package.hashtags}</p>
                {item.reason && <p className="text-xs text-destructive">{item.reason}</p>}
                {item.post_url && (
                  <a
                    className="text-sm text-primary"
                    href={item.post_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Buka publikasi
                  </a>
                )}
              </article>
            ))}
            <div className="divide-y divide-border border-y border-border">
              {["Instagram", "TikTok", "Facebook", "YouTube"].map((p) => (
                <div key={p} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <span className="font-medium">{p}</span>
                  <Badge variant="outline">
                    {p === "Instagram"
                      ? "Perlu verifikasi ulang akun & penjadwalan"
                      : "Menunggu otorisasi akun"}
                  </Badge>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Belum ada jadwal publikasi terverifikasi. Tidak ada konten yang diposting otomatis.
            </p>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

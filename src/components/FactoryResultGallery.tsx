import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ImageIcon,
  Layers,
  Play,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getFactoryAsset } from "@/lib/factory.functions";
import type { FactoryResult, ResultMedia } from "@/lib/factory-results";

const statusLabels = {
  ready: "Siap unduh",
  review: "Menunggu pemeriksaan",
  processing: "Sedang dibuat",
  blocked: "Perlu perhatian",
};
type Format = "poster" | "carousel" | "video";

function AssetPreview({ asset, compact = false }: { asset: ResultMedia; compact?: boolean }) {
  const sign = useServerFn(getFactoryAsset);
  const signed = useQuery({
    queryKey: ["factory-preview", asset.id],
    queryFn: () => sign({ data: { id: asset.id } }),
    staleTime: 45 * 60 * 1000,
    retry: false,
  });
  if (signed.isPending)
    return (
      <div className="flex h-full min-h-48 items-center justify-center bg-muted">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  if (!signed.data)
    return (
      <div className="flex h-full min-h-48 flex-col items-center justify-center gap-2 bg-muted text-sm text-muted-foreground">
        <AlertCircle className="size-5" />
        Pratinjau belum tersedia
        <Button variant="ghost" size="sm" onClick={() => void signed.refetch()}>
          Coba lagi
        </Button>
      </div>
    );
  return asset.kind === "video" ? (
    <video
      src={signed.data.url}
      controls={!compact}
      muted={compact}
      playsInline
      preload="metadata"
      aria-label="Video hasil produksi"
      className="h-full max-h-[60vh] w-full object-contain"
    />
  ) : (
    <img
      src={signed.data.url}
      alt={asset.path.split("/").at(-1) ?? "Hasil produksi"}
      className="h-full max-h-[60vh] w-full object-contain"
      loading="lazy"
    />
  );
}

async function copyCaption(result: FactoryResult) {
  try {
    await navigator.clipboard.writeText(
      [result.caption, result.hashtags].filter(Boolean).join("\n\n"),
    );
    toast.success("Caption disalin.");
  } catch {
    toast.error("Caption belum dapat disalin.");
  }
}

function ResultDetail({ result }: { result: FactoryResult }) {
  const [format, setFormat] = useState<Format>(
    result.formats.video.length ? "video" : result.formats.carousel.length ? "carousel" : "poster",
  );
  const [slide, setSlide] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const sign = useServerFn(getFactoryAsset);
  const assets = result.formats[format];
  const asset = assets[slide];
  useEffect(() => {
    setSlide(0);
  }, [format]);
  async function download() {
    if (!asset) return;
    setDownloading(true);
    try {
      const signed = await sign({ data: { id: asset.id } });
      const response = await fetch(signed.url);
      if (!response.ok) throw new Error("Unduhan belum tersedia.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = asset.path.split("/").at(-1) ?? "konten";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch {
      toast.error("Unduhan belum tersedia. Coba lagi.");
    } finally {
      setDownloading(false);
    }
  }
  return (
    <div className="min-w-0 space-y-5">
      <Tabs value={format} onValueChange={(value) => setFormat(value as Format)}>
        <TabsList className="w-full">
          {(["video", "carousel", "poster"] as const)
            .filter((f) => result.formats[f].length)
            .map((f) => (
              <TabsTrigger key={f} value={f} className="flex-1">
                {f === "video" ? "Video" : f === "carousel" ? "Carousel" : "Poster"}
              </TabsTrigger>
            ))}
        </TabsList>
        {(["video", "carousel", "poster"] as const).map((f) => (
          <TabsContent key={f} value={f}>
            <div className="flex h-[min(52vh,520px)] items-center justify-center overflow-hidden rounded-md bg-muted">
              {asset ? (
                <AssetPreview key={asset.id} asset={asset} />
              ) : (
                <p className="text-sm text-muted-foreground">Belum ada hasil.</p>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>
      {assets.length > 1 && (
        <div className="flex items-center justify-center gap-5">
          <Button
            variant="outline"
            size="icon"
            aria-label="Slide sebelumnya"
            disabled={slide === 0}
            onClick={() => setSlide((n) => n - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm tabular-nums">
            {slide + 1} / {assets.length}
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Slide berikutnya"
            disabled={slide >= assets.length - 1}
            onClick={() => setSlide((n) => n + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button disabled={!asset || downloading} onClick={() => void download()}>
          <Download className="size-4" />
          {downloading
            ? "Mengunduh…"
            : format === "carousel"
              ? `Unduh slide ${slide + 1}`
              : "Unduh konten"}
        </Button>
        <Button
          variant="outline"
          disabled={!result.caption}
          onClick={() => void copyCaption(result)}
        >
          <Copy className="size-4" />
          Caption
        </Button>
      </div>
      {result.caption && (
        <div className="max-h-40 overflow-y-auto whitespace-pre-wrap border-t border-border pt-4 text-sm leading-relaxed">
          {result.caption}
          <p className="mt-2 text-muted-foreground">{result.hashtags}</p>
        </div>
      )}
      {result.distribution.length > 0 && (
        <div className="space-y-2 border-t border-border pt-4">
          {result.distribution.map((item) => (
            <div key={item.id} className="text-xs">
              <span className="font-medium capitalize">
                {item.platform} · {item.format}
              </span>
              <span className="ml-2 text-muted-foreground">
                {item.postUrl
                  ? "Dipublikasikan"
                  : item.state === "unsupported_format"
                    ? "Format tidak didukung"
                    : "Belum dipublikasikan"}
              </span>
              {item.postUrl && (
                <a
                  href={item.postUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-primary"
                >
                  Buka posting
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function FactoryResultGallery({
  results,
  onCreate,
}: {
  results: FactoryResult[];
  onCreate: () => void;
}) {
  const [selected, setSelected] = useState<FactoryResult | null>(null);
  const liveSelected = results.find((r) => r.id === selected?.id) ?? selected;
  return (
    <>
      {!results.length ? (
        <div className="flex min-h-72 flex-col items-center justify-center gap-3 border-y border-border py-10 text-center">
          <Layers className="size-9 text-muted-foreground" />
          <h3 className="text-lg font-medium">Belum ada hasil konten</h3>
          <p className="max-w-xs text-sm text-muted-foreground">
            Video, carousel, dan poster yang selesai akan muncul di sini.
          </p>
          <Button className="mt-2" onClick={onCreate}>
            <Play className="size-4" />
            Buat konten
          </Button>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {results.map((result) => {
            const cover =
              result.formats.poster[0] ?? result.formats.carousel[0] ?? result.formats.video[0];
            return (
              <article
                key={result.id}
                className="min-w-0 overflow-hidden rounded-lg border border-border bg-card"
              >
                <div>
                  <div className="aspect-[4/5] w-full bg-muted">
                    {cover ? (
                      <AssetPreview asset={cover} compact />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
                        {result.status === "blocked" ? (
                          <AlertCircle className="size-8" />
                        ) : (
                          <Loader2 className="size-8 animate-spin" />
                        )}
                        <span className="text-sm">{statusLabels[result.status]}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-3 p-4">
                  <Badge variant={result.status === "blocked" ? "destructive" : "secondary"}>
                    {statusLabels[result.status]}
                  </Badge>
                  <h3 className="line-clamp-2 min-h-12 break-words text-base font-semibold leading-6">
                    {result.title}
                  </h3>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    {result.formats.video.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Play className="size-3.5" />
                        Video
                      </span>
                    )}
                    {result.formats.carousel.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Layers className="size-3.5" />
                        {result.formats.carousel.length} slide
                      </span>
                    )}
                    {result.formats.poster.length > 0 && (
                      <span className="flex items-center gap-1">
                        <ImageIcon className="size-3.5" />
                        Poster
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      disabled={!cover}
                      onClick={() => setSelected(result)}
                    >
                      Lihat hasil
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Salin caption"
                      aria-label={`Salin caption ${result.title}`}
                      disabled={!result.caption}
                      onClick={() => void copyCaption(result)}
                    >
                      <Copy className="size-4" />
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="break-words pr-5">{liveSelected?.title}</DialogTitle>
            <DialogDescription>
              {liveSelected ? statusLabels[liveSelected.status] : ""} · Belum dipublikasikan
              otomatis
            </DialogDescription>
          </DialogHeader>
          {liveSelected && <ResultDetail key={liveSelected.id} result={liveSelected} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

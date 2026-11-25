import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Heart,
  ImageUp,
  MessageCircle,
  Save,
  Send,
  X,
  Zap,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useMetaTokenStatus } from "@/lib/use-schedule-runner";
import {
  detectNumberFromFilename,
  fetchBank,
  fetchLogs,
  imagesOf,
  indexLogs,
  uploadImage,
} from "@/lib/content-data";
import { publishToInstagram } from "@/lib/instagram.functions";

type Search = { no?: number | undefined };

const MAX_IMAGES = 10;

export const Route = createFileRoute("/_authenticated/editor")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    no: search['no'] ? Number(search['no']) : undefined,
  }),

  head: () => ({
    meta: [
      { title: "Editor & Publisher — KERJAKU Instagram Publisher" },
      {
        name: "description",
        content:
          "Drop foto AI, cocokkan otomatis dengan caption bank konten, lalu publish instan atau jadwalkan lewat Meta.",
      },
      { property: "og:title", content: "Editor & Publisher — KERJAKU Instagram Publisher" },
      {
        property: "og:description",
        content: "Split-screen preview feed 4:5 dengan publish instan dan scheduling Meta.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EditorPage,
});

function EditorPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/editor" });
  const queryClient = useQueryClient();
  const tokenStatus = useMetaTokenStatus();
  const tokenState = tokenStatus.data?.state;
  const configured = tokenState === "active" || tokenState === "expiring_soon";
  const publish = useServerFn(publishToInstagram);

  const bank = useQuery({ queryKey: ["bank"], queryFn: fetchBank });
  const logs = useQuery({ queryKey: ["logs"], queryFn: fetchLogs });

  const rows = useMemo(() => bank.data ?? [], [bank.data]);
  const selectedNo = search.no ?? rows[0]?.no ?? 1;
  const row = rows.find((r) => r.no === selectedNo);
  const existing = indexLogs(logs.data ?? []).get(selectedNo);

  const [caption, setCaption] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [activeImage, setActiveImage] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [mode, setMode] = useState<"now" | "schedule">("now");
  const [scheduleAt, setScheduleAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const publishLogId = useRef<string | null>(null);

  useEffect(() => {
    setCaption(existing?.caption || row?.caption || "");
    setImageUrls(existing ? imagesOf(existing) : []);
    setActiveImage(0);
    publishLogId.current = existing?.status === "draft" || existing?.status === "failed" ? existing.id : null;
  }, [selectedNo, row?.caption, existing?.caption, existing?.image_url, existing?.image_urls]);

  async function handleFiles(files: File[]) {
    if (!files.length) return;
    const room = MAX_IMAGES - imageUrls.length;
    if (room <= 0) {
      toast.error(`Maksimal ${MAX_IMAGES} foto per postingan (aturan Instagram).`);
      return;
    }
    const batch = files.slice(0, room);
    if (files.length > room) {
      toast.info(`Hanya ${room} foto pertama dipakai — maksimal ${MAX_IMAGES} foto per postingan.`);
    }

    const detected = detectNumberFromFilename(batch[0]!.name);
    const target = detected && rows.some((r) => r.no === detected) ? detected : selectedNo;
    if (target !== selectedNo) {
      await navigate({ search: { no: target } });
      toast.info(`Nomor konten terdeteksi otomatis: #${target}`);
    }
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of batch) uploaded.push(await uploadImage(file, target));
      setImageUrls((prev) => [...prev, ...uploaded]);
      toast.success(
        uploaded.length > 1 ? `${uploaded.length} foto berhasil diunggah.` : "Foto berhasil diunggah.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mengunggah foto.");
    } finally {
      setUploading(false);
    }
  }

  function removeImage(index: number) {
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
    setActiveImage(0);
  }

  function moveImage(index: number, delta: number) {
    setImageUrls((prev) => {
      const next = [...prev];
      const to = index + delta;
      if (to < 0 || to >= next.length) return prev;
      [next[index], next[to]] = [next[to]!, next[index]!];
      return next;
    });
    setActiveImage(0);
  }

  async function handleSaveDraft() {
    if (!imageUrls.length) {
      toast.error("Unggah foto terlebih dahulu.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("content_logs").insert({
        content_number: selectedNo,
        title: row?.title ?? "",
        image_url: imageUrls[0]!,
        image_urls: imageUrls,
        caption,
        status: "draft",
        scheduled_at: null,
      });
      if (error) throw new Error(error.message);
      toast.success("Draft tersimpan. Cek preview di Content Grid.");
      await queryClient.invalidateQueries({ queryKey: ["logs"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan draft.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAction() {
    if (!configured) {
      toast.error(
        tokenState === "expired"
          ? "Instagram access token expired. Please update the Meta access token."
          : "Meta access token belum dikonfigurasi di server — cek halaman Settings.",
      );
      return;
    }
    if (!imageUrls.length) {
      toast.error("Unggah foto terlebih dahulu.");
      return;
    }
    let scheduledUnix: number | undefined;
    if (mode === "schedule") {
      if (!scheduleAt) {
        toast.error("Pilih tanggal & jam publikasi.");
        return;
      }
      const ts = new Date(scheduleAt).getTime();
      const minimum = Date.now() + 10 * 60 * 1000;
      if (ts < minimum) {
        toast.error("Jadwal minimal 10 menit dari sekarang (aturan Meta).");
        return;
      }
      scheduledUnix = Math.floor(ts / 1000);
    }

    setBusy(true);
    try {
      if (scheduledUnix) {
        // Meta's native IG scheduling is whitelist-gated ("User must be on
        // whitelist"), so the app queues the post and publishes it when due.
        const { error } = await supabase.from("content_logs").insert({
          content_number: selectedNo,
          title: row?.title ?? "",
          image_url: imageUrls[0]!,
        image_urls: imageUrls,
          caption,
          status: "scheduled",
          scheduled_at: new Date(scheduledUnix * 1000).toISOString(),
        });
        if (error) throw new Error(error.message);
        toast.success("Konten dijadwalkan. Biarkan aplikasi terbuka saat waktunya tiba.");
        await queryClient.invalidateQueries({ queryKey: ["logs"] });
        return;
      }

      if (!publishLogId.current) {
        const { data: log, error: createError } = await supabase.from("content_logs").insert({
          content_number: selectedNo, title: row?.title ?? "", image_url: imageUrls[0] ?? null,
          image_urls: imageUrls, caption, status: "draft", scheduled_at: null,
        }).select("id").single();
        if (createError || !log) throw new Error("Konten belum dapat disimpan; tidak diposting.");
        publishLogId.current = log.id;
      }
      await publish({ data: { contentLogId: publishLogId.current, imageUrls, caption } });

      toast.success("Konten berhasil tayang di Instagram.");
      await queryClient.invalidateQueries({ queryKey: ["logs"] });

    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal memproses ke Meta.";
      // The durable server job owns the outcome. Never create a replacement failed log
      // after an ambiguous platform response: that would allow duplicate submission.
      await queryClient.invalidateQueries({ queryKey: ["logs"] });
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Editor & Publisher</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {row ? `#${row.no} — ${row.title}` : "Pilih nomor konten"}
          </p>
        </div>
        {!configured ? (
          <Link
            to="/settings"
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
          >
            {tokenState === "expired"
              ? "Meta access token kedaluwarsa — buka Settings"
              : "Meta access token belum dikonfigurasi — buka Settings"}
          </Link>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        {/* Feed preview */}
        <section className="surface-panel overflow-hidden">
          <div className="flex items-center gap-3 border-b border-border/70 px-4 py-3">
            <span className="size-8 rounded-full bg-[var(--brand-gradient)]" />
            <div>
              <p className="text-sm font-semibold">kerjaku.space</p>
              <p className="text-[11px] text-muted-foreground">Sponsored preview</p>
            </div>
          </div>
          <div className="relative aspect-4/5 w-full bg-secondary/50">
            {imageUrls.length ? (
              <>
                <img
                  src={imageUrls[Math.min(activeImage, imageUrls.length - 1)]}
                  alt={`Preview konten ${selectedNo} foto ${activeImage + 1}`}
                  className="size-full object-cover"
                />
                {imageUrls.length > 1 ? (
                  <>
                    <span className="absolute right-3 top-3 rounded-full bg-background/80 px-2 py-1 text-[11px] font-medium">
                      {Math.min(activeImage, imageUrls.length - 1) + 1}/{imageUrls.length}
                    </span>
                    <button
                      type="button"
                      aria-label="Foto sebelumnya"
                      onClick={() => setActiveImage((i) => (i - 1 + imageUrls.length) % imageUrls.length)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-1.5"
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Foto berikutnya"
                      onClick={() => setActiveImage((i) => (i + 1) % imageUrls.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-1.5"
                    >
                      <ChevronRight className="size-4" />
                    </button>
                  </>
                ) : null}
              </>
            ) : (
              <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
                <ImageUp className="size-8" />
                <p className="text-xs">1080 × 1350 — 4:5 portrait</p>
              </div>
            )}
          </div>
          <div className="space-y-3 px-4 py-4">
            <div className="flex gap-4 text-muted-foreground">
              <Heart className="size-5" />
              <MessageCircle className="size-5" />
              <Send className="size-5" />
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              <span className="font-semibold">kerjaku.space </span>
              {caption || "Caption akan muncul di sini."}
            </p>
          </div>
        </section>

        {/* Controls */}
        <section className="space-y-5">
          <div className="surface-panel p-5">
            <Label className="mb-2 block">Nomor Konten</Label>
            <Select
              value={String(selectedNo)}
              onValueChange={(v) => void navigate({ search: { no: Number(v) } })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih konten" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {rows.map((r) => (
                  <SelectItem key={r.no} value={String(r.no)}>
                    No. {r.no} — {r.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div
              role="button"
              tabIndex={0}
              onClick={() => fileRef.current?.click()}
              onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                void handleFiles(Array.from(e.dataTransfer.files ?? []));
              }}
              className={`mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center transition-colors ${
                dragging ? "border-primary bg-primary/10" : "border-border hover:border-primary/60"
              }`}
            >
              <ImageUp className="size-6 text-primary" />
              <p className="text-sm font-medium">
                {uploading ? "Mengunggah…" : "Drop foto AI di sini (bisa pilih banyak)"}
              </p>
              <p className="text-xs text-muted-foreground">
                Pilih 2–{MAX_IMAGES} foto untuk membuat carousel. Nomor pada nama file otomatis
                dicocokkan dengan bank konten.
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                void handleFiles(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />

            {imageUrls.length ? (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-muted-foreground">
                  {imageUrls.length > 1
                    ? `Carousel — ${imageUrls.length} foto, urutan sesuai daftar di bawah.`
                    : "1 foto — postingan tunggal."}
                </p>
                <div className="flex flex-wrap gap-2">
                  {imageUrls.map((url, index) => (
                    <div
                      key={url}
                      className={`relative size-20 overflow-hidden rounded-lg border ${
                        index === activeImage ? "border-primary" : "border-border"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveImage(index)}
                        className="size-full"
                        aria-label={`Lihat foto ${index + 1}`}
                      >
                        <img src={url} alt={`Foto ${index + 1}`} className="size-full object-cover" />
                      </button>
                      <span className="absolute left-1 top-1 rounded bg-background/85 px-1 text-[10px] font-semibold">
                        {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        aria-label={`Hapus foto ${index + 1}`}
                        className="absolute right-1 top-1 rounded bg-background/85 p-0.5 text-destructive"
                      >
                        <X className="size-3" />
                      </button>
                      <div className="absolute inset-x-0 bottom-0 flex justify-between bg-background/80">
                        <button
                          type="button"
                          onClick={() => moveImage(index, -1)}
                          disabled={index === 0}
                          aria-label={`Geser foto ${index + 1} ke kiri`}
                          className="px-1 disabled:opacity-30"
                        >
                          <ChevronLeft className="size-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveImage(index, 1)}
                          disabled={index === imageUrls.length - 1}
                          aria-label={`Geser foto ${index + 1} ke kanan`}
                          className="px-1 disabled:opacity-30"
                        >
                          <ChevronRight className="size-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="surface-panel p-5">
            <Label htmlFor="caption" className="mb-2 block">
              Caption
            </Label>
            <Textarea
              id="caption"
              rows={10}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="resize-y"
            />
            <p className="mt-2 text-xs text-muted-foreground">{caption.length} karakter</p>
          </div>

          <div className="surface-panel p-5">
            <Label className="mb-3 block">Mode Publikasi</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              <ModeCard
                active={mode === "now"}
                icon={Zap}
                title="Publish Instan"
                description="Container + media_publish langsung."
                onClick={() => setMode("now")}
              />
              <ModeCard
                active={mode === "schedule"}
                icon={CalendarClock}
                title="Schedule Post"
                description="Antrean aplikasi, tayang otomatis saat waktunya."
                onClick={() => setMode("schedule")}
              />
            </div>

            {mode === "schedule" ? (
              <div className="mt-4 space-y-2">
                <Label htmlFor="schedule">Tanggal & Jam</Label>
                <Input
                  id="schedule"
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={(e) => setScheduleAt(e.target.value)}
                />
              </div>
            ) : null}

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Button
                variant="outline"
                size="lg"
                disabled={busy || uploading}
                onClick={() => void handleSaveDraft()}
              >
                <Save className="size-4" />
                Simpan Draft
              </Button>
              <Button size="lg" disabled={busy || uploading} onClick={() => void handleAction()}>
                {busy
                  ? "Memproses…"
                  : mode === "now"
                    ? "Publish Now"
                    : "Schedule Content"}
              </Button>
            </div>
          </div>

          {existing ? (
            <p className="text-xs text-muted-foreground">
              Riwayat terakhir: <span className="capitalize text-foreground">{existing.status}</span>{" "}
              · {new Date(existing.created_at).toLocaleString("id-ID")}
              {existing.error_message ? ` · ${existing.error_message}` : ""}
            </p>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}

function ModeCard({
  active,
  icon: Icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: typeof Zap;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left transition-all ${
        active ? "border-primary bg-primary/10 glow-ring" : "border-border hover:border-primary/50"
      }`}
    >
      <Icon className={`size-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
      <p className="mt-2 text-sm font-semibold">{title}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </button>
  );
}

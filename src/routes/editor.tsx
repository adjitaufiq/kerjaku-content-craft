import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CalendarClock, Heart, ImageUp, MessageCircle, Send, Zap } from "lucide-react";

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
import { useIgSettings } from "@/lib/ig-settings";
import { detectNumberFromFilename, fetchBank, fetchLogs, indexLogs, uploadImage } from "@/lib/content-data";
import { publishToInstagram } from "@/lib/instagram.functions";

type Search = { no?: number | undefined };

export const Route = createFileRoute("/editor")({
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
    ],
  }),
  component: EditorPage,
});

function EditorPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/editor" });
  const queryClient = useQueryClient();
  const { settings, configured } = useIgSettings();
  const publish = useServerFn(publishToInstagram);

  const bank = useQuery({ queryKey: ["bank"], queryFn: fetchBank });
  const logs = useQuery({ queryKey: ["logs"], queryFn: fetchLogs });

  const rows = useMemo(() => bank.data ?? [], [bank.data]);
  const selectedNo = search.no ?? rows[0]?.no ?? 1;
  const row = rows.find((r) => r.no === selectedNo);
  const existing = indexLogs(logs.data ?? []).get(selectedNo);

  const [caption, setCaption] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [mode, setMode] = useState<"now" | "schedule">("now");
  const [scheduleAt, setScheduleAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCaption(existing?.caption || row?.caption || "");
    setImageUrl(existing?.image_url ?? null);
  }, [selectedNo, row?.caption, existing?.caption, existing?.image_url]);

  async function handleFile(file: File) {
    const detected = detectNumberFromFilename(file.name);
    const target = detected && rows.some((r) => r.no === detected) ? detected : selectedNo;
    if (target !== selectedNo) {
      await navigate({ search: { no: target } });
      toast.info(`Nomor konten terdeteksi otomatis: #${target}`);
    }
    setUploading(true);
    try {
      const url = await uploadImage(file, target);
      setImageUrl(url);
      toast.success("Foto berhasil diunggah.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mengunggah foto.");
    } finally {
      setUploading(false);
    }
  }

  async function handleAction() {
    if (!configured) {
      toast.error("Isi Account ID & Access Token di halaman Settings dulu.");
      return;
    }
    if (!imageUrl) {
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
          image_url: imageUrl,
          caption,
          status: "scheduled",
          scheduled_at: new Date(scheduledUnix * 1000).toISOString(),
        });
        if (error) throw new Error(error.message);
        toast.success("Konten dijadwalkan. Biarkan aplikasi terbuka saat waktunya tiba.");
        await queryClient.invalidateQueries({ queryKey: ["logs"] });
        return;
      }

      const result = await publish({
        data: {
          igAccountId: settings.igAccountId,
          accessToken: settings.accessToken,
          imageUrl,
          caption,
        },
      });

      await supabase.from("content_logs").insert({
        content_number: selectedNo,
        title: row?.title ?? "",
        image_url: imageUrl,
        caption,
        status: result.mode,
        ig_creation_id: result.creationId,
        ig_post_id: result.postId,
        scheduled_at: null,
      });

      toast.success("Konten berhasil tayang di Instagram.");
      await queryClient.invalidateQueries({ queryKey: ["logs"] });

    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal memproses ke Meta.";
      await supabase.from("content_logs").insert({
        content_number: selectedNo,
        title: row?.title ?? "",
        image_url: imageUrl,
        caption,
        status: "failed",
        error_message: message,
      });
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
            Kredensial Meta belum diisi — buka Settings
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
          <div className="aspect-4/5 w-full bg-secondary/50">
            {imageUrl ? (
              <img src={imageUrl} alt={`Preview konten ${selectedNo}`} className="size-full object-cover" />
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
                const file = e.dataTransfer.files?.[0];
                if (file) void handleFile(file);
              }}
              className={`mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center transition-colors ${
                dragging ? "border-primary bg-primary/10" : "border-border hover:border-primary/60"
              }`}
            >
              <ImageUp className="size-6 text-primary" />
              <p className="text-sm font-medium">
                {uploading ? "Mengunggah…" : "Drop foto AI di sini (mis. 7.png)"}
              </p>
              <p className="text-xs text-muted-foreground">
                Nomor pada nama file otomatis dicocokkan dengan bank konten.
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
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

            <Button className="mt-5 w-full" size="lg" disabled={busy || uploading} onClick={() => void handleAction()}>
              {busy
                ? "Memproses…"
                : mode === "now"
                  ? "Publish Now"
                  : "Schedule Content"}
            </Button>
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

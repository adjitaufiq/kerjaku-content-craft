import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Clock, Film, Loader2, Trash2, UploadCloud, Video } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
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
import {
  SOURCE_CATEGORIES,
  SOURCE_PLATFORMS,
  SOURCE_RETENTION_DAYS,
  SOURCE_STATUSES,
  createViralSource,
  deleteViralSource,
  listViralSources,
  updateViralSource,
  type SourceStatus,
  type ViralSource,
} from "@/lib/viral-sources.functions";

export const Route = createFileRoute("/_authenticated/sources")({
  head: () => ({
    meta: [
      { title: "Viral Source Intake — KERJAKU Cliper Intelligence" },
      {
        name: "description",
        content:
          "Kumpulkan sumber konten viral: unggah video pendek atau simpan tautan Reel, TikTok, dan YouTube Shorts lengkap dengan status pipeline.",
      },
      { property: "og:title", content: "Viral Source Intake — KERJAKU Cliper Intelligence" },
      {
        property: "og:description",
        content: "Fondasi intake sumber konten viral dengan penyimpanan privat dan status pipeline.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SourcesPage,
});

const STATUS_LABEL: Record<SourceStatus, string> = {
  draft: "Draft",
  processing: "Processing",
  understanding: "Understanding",
  source_extracted: "Source Extracted",
  analysis_complete: "Analysis Complete",
  production: "Production",
  approved: "Approved",
  published: "Published",
  failed: "Failed",
};

function statusTone(status: SourceStatus) {
  if (status === "failed") return "border-destructive/40 bg-destructive/15 text-destructive";
  if (status === "published" || status === "approved" || status === "analysis_complete")
    return "border-accent/40 bg-accent/15 text-accent";
  if (status === "draft") return "border-border bg-secondary/60 text-muted-foreground";
  return "border-primary/40 bg-primary/15 text-primary";
}

function platformLabel(value: string) {
  return SOURCE_PLATFORMS.find((p) => p.value === value)?.label ?? value;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function expiryText(value: string | null) {
  if (!value) return "Tanpa video (tidak kedaluwarsa)";
  const ms = new Date(value).getTime() - Date.now();
  if (ms <= 0) return "Video sumber sudah kedaluwarsa";
  const hours = Math.round(ms / 3_600_000);
  if (hours < 24) return `Video hangus dalam ${hours} jam`;
  return `Video hangus dalam ${Math.round(hours / 24)} hari`;
}

function SourcesPage() {
  const queryClient = useQueryClient();
  const fetchList = useServerFn(listViralSources);
  const runCreate = useServerFn(createViralSource);
  const runUpdate = useServerFn(updateViralSource);
  const runDelete = useServerFn(deleteViralSource);

  const list = useQuery({ queryKey: ["viral-sources"], queryFn: () => fetchList({}) });
  const rows = list.data ?? [];

  const [platform, setPlatform] = useState<string>("upload");
  const [title, setTitle] = useState("");
  const [creator, setCreator] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [category, setCategory] = useState<string>("none");
  const [notes, setNotes] = useState("");
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [videoName, setVideoName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  function resetForm() {
    setTitle("");
    setCreator("");
    setSourceUrl("");
    setCategory("none");
    setNotes("");
    setVideoPath(null);
    setVideoName(null);
  }

  async function uploadVideo(file: File) {
    const ok = /\.(mp4|mov|m4v|webm)$/i.test(file.name);
    if (!ok) {
      toast.error("Format video harus MP4 atau MOV.");
      return;
    }
    setUploading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Sesi berakhir, silakan masuk kembali.");
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "mp4";
      const path = `${uid}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("viral-sources")
        .upload(path, file, { upsert: false, contentType: file.type || "video/mp4" });
      if (error) throw error;
      setVideoPath(path);
      setVideoName(file.name);
      toast.success("Video tersimpan di penyimpanan privat.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengunggah video.");
    } finally {
      setUploading(false);
    }
  }

  const create = useMutation({
    mutationFn: () =>
      runCreate({
        data: {
          title,
          platform,
          sourceUrl: sourceUrl || null,
          creatorName: creator || null,
          category: category === "none" ? null : category,
          notes,
          videoPath,
        },
      }),
    onSuccess: () => {
      resetForm();
      void queryClient.invalidateQueries({ queryKey: ["viral-sources"] });
      toast.success("Sumber viral tersimpan dengan status Draft.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const patch = useMutation({
    mutationFn: (input: { id: string; status: SourceStatus }) => runUpdate({ data: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["viral-sources"] }),
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => runDelete({ data: { id } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["viral-sources"] });
      toast.success("Sumber dihapus.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="space-y-1.5">
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Viral <span className="brand-text">Source Intake</span>
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Kumpulkan sumber konten viral sebagai bahan reverse engineering. Video tersimpan privat
            dan otomatis kedaluwarsa dalam {SOURCE_RETENTION_DAYS} hari; catatan dan hasil analisis
            tetap tersimpan.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <section className="surface-panel space-y-4 p-5">
            <h2 className="font-display text-sm font-semibold">Tambah Sumber</h2>

            <div className="space-y-2">
              <Label htmlFor="source-video">Upload video (MP4 / MOV)</Label>
              <label
                htmlFor="source-video"
                className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-secondary/40 px-3 py-6 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              >
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <UploadCloud className="size-4" />
                )}
                {uploading ? "Mengunggah…" : (videoName ?? "Pilih file video")}
              </label>
              <input
                id="source-video"
                type="file"
                accept="video/mp4,video/quicktime,video/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void uploadVideo(file);
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>Platform</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_PLATFORMS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="source-url">Link sumber (opsional, sebagai metadata)</Label>
              <Input
                id="source-url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://www.instagram.com/reel/..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="source-title">Judul</Label>
              <Input
                id="source-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Hook 3 detik — cerita gagal interview"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="source-creator">Nama kreator</Label>
              <Input
                id="source-creator"
                value={creator}
                onChange={(e) => setCreator(e.target.value)}
                placeholder="@nama.kreator"
              />
            </div>

            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tanpa kategori</SelectItem>
                  {SOURCE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="source-notes">Catatan</Label>
              <Textarea
                id="source-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Kenapa konten ini menarik untuk dibedah?"
              />
            </div>

            <Button
              className="w-full"
              disabled={create.isPending || uploading}
              onClick={() => create.mutate()}
            >
              {create.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Simpan Sumber
            </Button>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold">Source Library</h2>
              <span className="text-xs text-muted-foreground">{rows.length} sumber</span>
            </div>

            {list.isLoading ? (
              <div className="surface-panel flex items-center gap-2 p-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Memuat sumber…
              </div>
            ) : rows.length === 0 ? (
              <div className="surface-panel p-8 text-center text-sm text-muted-foreground">
                Belum ada sumber viral. Unggah video atau tempel tautan di sebelah kiri.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {rows.map((row) => (
                  <SourceCard
                    key={row.id}
                    row={row}
                    onStatus={(status) => patch.mutate({ id: row.id, status })}
                    onDelete={() => remove.mutate(row.id)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function SourceCard({
  row,
  onStatus,
  onDelete,
}: {
  row: ViralSource;
  onStatus: (status: SourceStatus) => void;
  onDelete: () => void;
}) {
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!row.video_path) {
      setThumb(null);
      return;
    }
    void supabase.storage
      .from("viral-sources")
      .createSignedUrl(row.video_path, 60 * 60)
      .then(({ data }) => {
        if (active) setThumb(data?.signedUrl ?? null);
      });
    return () => {
      active = false;
    };
  }, [row.video_path]);

  return (
    <article className="surface-panel space-y-3 p-4">
      <div className="overflow-hidden rounded-xl bg-secondary/60">
        {thumb ? (
          <video src={thumb} controls className="aspect-9/16 max-h-64 w-full object-cover" />
        ) : row.thumbnail_url ? (
          <img src={thumb ?? row.thumbnail_url} alt="" className="aspect-9/16 max-h-64 w-full object-cover" />
        ) : (
          <div className="flex aspect-video items-center justify-center text-muted-foreground">
            <Film className="size-6" />
          </div>
        )}
      </div>

      <div className="space-y-1">
        <p className="line-clamp-2 text-sm font-semibold">{row.title || "Tanpa judul"}</p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="gap-1">
            <Video className="size-3" />
            {platformLabel(row.platform)}
          </Badge>
          <span>{row.creator_name ?? "Kreator tidak diketahui"}</span>
        </div>
      </div>

      <Badge variant="outline" className={statusTone(row.status)}>
        {STATUS_LABEL[row.status]}
      </Badge>

      {row.category ? <p className="text-xs text-muted-foreground">{row.category}</p> : null}
      {row.notes ? <p className="line-clamp-3 text-xs text-muted-foreground">{row.notes}</p> : null}

      <div className="space-y-1 text-[11px] text-muted-foreground">
        <p>Dibuat: {formatDate(row.created_at)}</p>
        <p className="flex items-center gap-1">
          <Clock className="size-3" />
          {expiryText(row.expires_at)}
        </p>
        {row.source_url ? (
          <a
            href={row.source_url}
            target="_blank"
            rel="noreferrer noopener"
            className="block truncate text-primary hover:underline"
          >
            {row.source_url}
          </a>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <Select value={row.status} onValueChange={(v) => onStatus(v as SourceStatus)}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SOURCE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Hapus sumber">
          <Trash2 className="size-4" />
        </Button>
      </div>
    </article>
  );
}

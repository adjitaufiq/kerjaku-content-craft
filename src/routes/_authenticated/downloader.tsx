import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Download,
  ExternalLink,
  Film,
  Heart,
  Loader2,
  PlusCircle,
  Search,
  Trash2,
  UploadCloud,
} from "lucide-react";

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
  addToContentBank,
  analyzeAndDownload,
  deleteDownload,
  listDownloads,
  updateDownloadMeta,
  type DownloadRow,
} from "@/lib/downloads.functions";

const CATEGORIES = [
  "Hook Reference",
  "Storytelling",
  "Sales Content",
  "Educational",
  "Branding",
  "Viral Reference",
] as const;

export const Route = createFileRoute("/_authenticated/downloader")({
  head: () => ({
    meta: [
      { title: "Content Downloader — KERJAKU Instagram Publisher" },
      {
        name: "description",
        content:
          "Simpan referensi Reels publik lengkap dengan thumbnail, caption, kategori riset, catatan, dan tag untuk analisis konten KERJAKU.",
      },
      { property: "og:title", content: "Content Downloader — KERJAKU Instagram Publisher" },
      {
        property: "og:description",
        content: "Perpustakaan riset konten: kumpulkan, kategorikan, dan ubah referensi jadi draft.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DownloaderPage,
});

function statusTone(status: string) {
  if (status === "completed") return "bg-accent/15 text-accent border-accent/40";
  if (status === "processing") return "bg-primary/15 text-primary border-primary/40";
  return "bg-destructive/15 text-destructive border-destructive/40";
}

function DownloaderPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const fetchList = useServerFn(listDownloads);
  const runAnalyze = useServerFn(analyzeAndDownload);
  const runUpdate = useServerFn(updateDownloadMeta);
  const runDelete = useServerFn(deleteDownload);
  const runAddToBank = useServerFn(addToContentBank);

  const list = useQuery({ queryKey: ["downloads"], queryFn: () => fetchList({}) });
  const rows = useMemo(() => list.data ?? [], [list.data]);

  const [url, setUrl] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [onlyFavorite, setOnlyFavorite] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId && rows.length) setSelectedId(rows[0]!.id);
  }, [rows, selectedId]);

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  const analyze = useMutation({
    mutationFn: (download: boolean) => runAnalyze({ data: { url, download } }),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["downloads"] });
      setSelectedId(res.id);
      if (res.status === "completed") {
        setUrl("");
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const patch = useMutation({
    mutationFn: (input: Parameters<typeof runUpdate>[0]["data"]) => runUpdate({ data: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["downloads"] }),
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => runDelete({ data: { id } }),
    onSuccess: () => {
      setSelectedId(null);
      void queryClient.invalidateQueries({ queryKey: ["downloads"] });
      toast.success("Referensi dihapus.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toBank = useMutation({
    mutationFn: (id: string) => runAddToBank({ data: { id } }),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ["bank"] });
      toast.success(`Ditambahkan sebagai konten #${res.contentNumber}.`);
      void navigate({ to: "/editor", search: { no: res.contentNumber } });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = rows.filter((r) => {
    if (filterCategory !== "all" && r.category !== filterCategory) return false;
    if (onlyFavorite && !r.is_favorite) return false;
    if (search) {
      const q = search.toLowerCase();
      const haystack = `${r.creator_username ?? ""} ${r.caption} ${r.notes} ${r.tags.join(" ")}`;
      if (!haystack.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Content Downloader</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Simpan referensi Reels publik untuk riset hook, storytelling, dan pola viral.
        </p>
      </div>

      <div className="surface-panel mb-8 p-5">
        <Label htmlFor="ig-url">Instagram URL</Label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <Input
            id="ig-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.instagram.com/reel/xxxxx/"
            className="flex-1"
          />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={!url || analyze.isPending}
              onClick={() => analyze.mutate(false)}
            >
              {analyze.isPending ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              Analyze
            </Button>
            <Button disabled={!url || analyze.isPending} onClick={() => analyze.mutate(true)}>
              {analyze.isPending ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              Download
            </Button>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Hanya konten publik. Bila Instagram tidak membagikan file videonya, metadata dan thumbnail
          tetap tersimpan dan Anda bisa mengunggah videonya sendiri di panel kanan.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Semua kategori" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua kategori</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari caption, kreator, tag…"
          className="w-64"
        />
        <Button
          variant={onlyFavorite ? "default" : "secondary"}
          onClick={() => setOnlyFavorite((v) => !v)}
        >
          <Heart className="size-4" />
          Favorit
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="surface-panel overflow-hidden">
          <div className="border-b border-border/70 px-4 py-3 text-sm font-semibold">
            Download Queue ({filtered.length})
          </div>
          {list.isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Memuat…</p>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Belum ada referensi.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {filtered.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(row.id)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/60 ${
                      row.id === selectedId ? "bg-primary/10" : ""
                    }`}
                  >
                    <Thumb row={row} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold">
                          {row.creator_username ? `@${row.creator_username}` : row.source_url}
                        </span>
                        {row.is_favorite ? <Heart className="size-3.5 fill-primary text-primary" /> : null}
                      </span>
                      <span className="mt-0.5 line-clamp-1 block text-xs text-muted-foreground">
                        {row.status === "failed" ? row.error_message : row.caption || "Tanpa caption"}
                      </span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className={`capitalize ${statusTone(row.status)}`}>
                          {row.status}
                        </Badge>
                        {row.category ? (
                          <Badge variant="outline" className="text-[10px]">
                            {row.category}
                          </Badge>
                        ) : null}
                        {row.video_path ? (
                          <Badge variant="outline" className="text-[10px]">
                            <Film className="mr-1 size-3" /> video
                          </Badge>
                        ) : null}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {selected ? (
          <DetailPanel
            key={selected.id}
            row={selected}
            onPatch={(input) => patch.mutate({ id: selected.id, ...input })}
            onDelete={() => remove.mutate(selected.id)}
            onAddToBank={() => toBank.mutate(selected.id)}
            addingToBank={toBank.isPending}
          />
        ) : (
          <div className="surface-panel p-5 text-sm text-muted-foreground">
            Pilih satu referensi untuk melihat detailnya.
          </div>
        )}
      </div>
    </AppShell>
  );
}

function useSignedUrl(path: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (!path) {
      setUrl(null);
      return;
    }
    void supabase.storage
      .from("content-research")
      .createSignedUrl(path, 60 * 60)
      .then(({ data }) => {
        if (active) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      active = false;
    };
  }, [path]);
  return url;
}

function Thumb({ row }: { row: DownloadRow }) {
  const signed = useSignedUrl(row.thumbnail_path);
  const src = signed ?? row.thumbnail_url;
  return (
    <span className="block size-14 shrink-0 overflow-hidden rounded-lg bg-secondary/60">
      {src ? (
        <img src={src} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <span className="flex size-full items-center justify-center text-muted-foreground">
          <Film className="size-4" />
        </span>
      )}
    </span>
  );
}

function DetailPanel({
  row,
  onPatch,
  onDelete,
  onAddToBank,
  addingToBank,
}: {
  row: DownloadRow;
  onPatch: (input: Record<string, unknown>) => void;
  onDelete: () => void;
  onAddToBank: () => void;
  addingToBank: boolean;
}) {
  const videoUrl = useSignedUrl(row.video_path);
  const thumbUrl = useSignedUrl(row.thumbnail_path);
  const [notes, setNotes] = useState(row.notes);
  const [tags, setTags] = useState(row.tags.join(", "));
  const [uploading, setUploading] = useState(false);

  async function uploadVideo(file: File) {
    setUploading(true);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Sesi berakhir, silakan masuk kembali.");
      const path = `${auth.user.id}/${row.id}/video.mp4`;
      const { error } = await supabase.storage
        .from("content-research")
        .upload(path, file, { upsert: true, contentType: file.type || "video/mp4" });
      if (error) throw error;
      onPatch({ video_path: path });
      toast.success("Video referensi tersimpan.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengunggah video.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="surface-panel space-y-4 p-5">
      <div className="overflow-hidden rounded-xl bg-secondary/60">
        {videoUrl ? (
          <video src={videoUrl} controls poster={thumbUrl ?? undefined} className="aspect-9/16 w-full object-cover" />
        ) : thumbUrl || row.thumbnail_url ? (
          <img
            src={thumbUrl ?? row.thumbnail_url!}
            alt="Thumbnail referensi"
            className="aspect-9/16 w-full object-cover"
          />
        ) : (
          <div className="flex aspect-9/16 items-center justify-center text-muted-foreground">
            <Film className="size-8" />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {row.creator_username ? `@${row.creator_username}` : "Kreator tidak diketahui"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {row.content_type} · {row.resolution ?? "resolusi tidak diketahui"}
          </p>
        </div>
        <div className="flex gap-1">
          <Button
            size="icon"
            variant={row.is_favorite ? "default" : "secondary"}
            onClick={() => onPatch({ is_favorite: !row.is_favorite })}
            aria-label="Tandai favorit"
          >
            <Heart className="size-4" />
          </Button>
          <Button size="icon" variant="secondary" asChild aria-label="Buka di Instagram">
            <a href={row.source_url} target="_blank" rel="noreferrer noopener">
              <ExternalLink className="size-4" />
            </a>
          </Button>
          <Button size="icon" variant="secondary" onClick={onDelete} aria-label="Hapus referensi">
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div>
        <Label>Kategori</Label>
        <Select value={row.category ?? ""} onValueChange={(v) => onPatch({ category: v })}>
          <SelectTrigger className="mt-1.5">
            <SelectValue placeholder="Pilih kategori riset" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="notes">Catatan</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== row.notes && onPatch({ notes })}
          rows={3}
          className="mt-1.5"
          placeholder="Apa yang membuat konten ini bekerja?"
        />
      </div>

      <div>
        <Label htmlFor="tags">Tags (pisahkan dengan koma)</Label>
        <Input
          id="tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          onBlur={() =>
            onPatch({
              tags: tags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
            })
          }
          className="mt-1.5"
        />
      </div>

      {row.caption ? (
        <div>
          <Label>Caption asli</Label>
          <p className="mt-1.5 max-h-32 overflow-y-auto whitespace-pre-wrap rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground">
            {row.caption}
          </p>
        </div>
      ) : null}

      <div>
        <Label htmlFor="video-upload">Unggah video referensi (opsional)</Label>
        <label
          htmlFor="video-upload"
          className="mt-1.5 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border/70 px-3 py-4 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
          {uploading ? "Mengunggah…" : "Pilih file video milik Anda"}
        </label>
        <input
          id="video-upload"
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadVideo(file);
            e.target.value = "";
          }}
        />
      </div>

      <Button className="w-full" onClick={onAddToBank} disabled={addingToBank}>
        {addingToBank ? <Loader2 className="size-4 animate-spin" /> : <PlusCircle className="size-4" />}
        Add to Content Bank
      </Button>
    </div>
  );
}

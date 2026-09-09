import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Brain,
  ExternalLink,
  Loader2,
  PlusCircle,
  Sparkles,
  Trash2,
  UploadCloud,
  Wand2,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { ContentRemixView } from "@/components/ContentRemixView";
import { ViralAnalysisReportView } from "@/components/ViralAnalysisReport";
import {
  deleteContentRemix,
  generateContentRemixFn,
  listContentRemixes,
} from "@/lib/content-remix.functions";
import {
  analyzeViralReferenceFn,
  deleteAnalysisReport,
  listAnalysisReports,
} from "@/lib/viral-analysis.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  CONTENT_TYPES,
  WORKFLOW_STATUSES,
  createGeneratedDraft,
  createViralReference,
  deleteGeneratedDraft,
  deleteViralReference,
  listViralWorkspace,
  updateGeneratedDraft,
  updateViralReference,
  type ContentType,
  type WorkflowStatus,
} from "@/lib/viral.functions";

const STATUS_LABEL: Record<WorkflowStatus, string> = {
  draft: "Draft",
  analyzing: "Analyzing",
  analyzed: "Analyzed",
  revision_needed: "Revision Needed",
  approved: "Approved",
  ready_production: "Ready Production",
  published: "Published",
};

const STATUS_CLASS: Record<WorkflowStatus, string> = {
  draft: "bg-secondary text-muted-foreground",
  analyzing: "bg-amber-500/15 text-amber-400",
  analyzed: "bg-sky-500/15 text-sky-400",
  revision_needed: "bg-destructive/15 text-destructive",
  approved: "bg-emerald-500/15 text-emerald-400",
  ready_production: "bg-primary/15 text-primary",
  published: "bg-violet-500/15 text-violet-400",
};

const TYPE_LABEL: Record<ContentType, string> = {
  carousel: "Carousel",
  photo_to_video: "Photo To Video",
  video_content: "Video Content",
};

const PLATFORMS = ["instagram", "tiktok", "upload"] as const;
const CATEGORIES = [
  "Hook Reference",
  "Storytelling",
  "Sales Content",
  "Educational",
  "Branding",
  "Viral Reference",
] as const;

export const Route = createFileRoute("/_authenticated/viral")({
  head: () => ({
    meta: [
      { title: "Viral Content Intelligence — KERJAKU Publisher" },
      {
        name: "description",
        content:
          "Kumpulkan referensi konten viral dari TikTok, Instagram, atau unggahan video, lalu kelola alur kerjanya sampai siap produksi.",
      },
      { property: "og:title", content: "Viral Content Intelligence — KERJAKU Publisher" },
      {
        property: "og:description",
        content: "Workspace referensi viral, draft konten, dan status alur kerja produksi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ViralPage,
});

function ViralPage() {
  const queryClient = useQueryClient();
  const fetchWorkspace = useServerFn(listViralWorkspace);
  const addReference = useServerFn(createViralReference);
  const patchReference = useServerFn(updateViralReference);
  const removeReference = useServerFn(deleteViralReference);
  const addDraft = useServerFn(createGeneratedDraft);
  const patchDraft = useServerFn(updateGeneratedDraft);
  const removeDraft = useServerFn(deleteGeneratedDraft);

  const runAnalysis = useServerFn(analyzeViralReferenceFn);
  const fetchReports = useServerFn(listAnalysisReports);
  const removeReport = useServerFn(deleteAnalysisReport);

  const workspace = useQuery({
    queryKey: ["viral-workspace"],
    queryFn: () => fetchWorkspace({}),
  });

  const reports = useQuery({
    queryKey: ["viral-reports"],
    queryFn: () => fetchReports({}),
  });

  const analyze = useMutation({
    mutationFn: (id: string) => runAnalysis({ data: { referenceId: id } }),
    onSuccess: (_d, id) => {
      toast.success("Analisis viral selesai.");
      setSelectedRef(id);
      void invalidate();
    },
    onError: (e: Error) => {
      toast.error(e.message);
      void invalidate();
    },
  });

  const dropReport = useMutation({
    mutationFn: (id: string) => removeReport({ data: { referenceId: id } }),
    onSuccess: () => {
      toast.success("Laporan analisis dihapus.");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runRemix = useServerFn(generateContentRemixFn);
  const fetchRemixes = useServerFn(listContentRemixes);
  const removeRemix = useServerFn(deleteContentRemix);

  const remixes = useQuery({
    queryKey: ["viral-remixes"],
    queryFn: () => fetchRemixes({}),
  });

  const remix = useMutation({
    mutationFn: (id: string) => runRemix({ data: { referenceId: id } }),
    onSuccess: (_d, id) => {
      toast.success("Konten KERJAKU berhasil dibuat.");
      setSelectedRef(id);
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dropRemix = useMutation({
    mutationFn: (id: string) => removeRemix({ data: { referenceId: id } }),
    onSuccess: () => {
      toast.success("Hasil remix dihapus.");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState<string>("instagram");
  const [sourceUrl, setSourceUrl] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftType, setDraftType] = useState<ContentType>("carousel");

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["viral-workspace"] });
    void queryClient.invalidateQueries({ queryKey: ["viral-reports"] });
  };

  const create = useMutation({
    mutationFn: () =>
      addReference({
        data: {
          title,
          sourcePlatform: platform,
          sourceUrl: sourceUrl || null,
          uploadedFile,
          category,
        },
      }),
    onSuccess: () => {
      toast.success("Referensi viral ditambahkan.");
      setTitle("");
      setSourceUrl("");
      setUploadedFile(null);
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setRefStatus = useMutation({
    mutationFn: (vars: { id: string; status: WorkflowStatus }) =>
      patchReference({ data: { id: vars.id, status: vars.status } }),
    onSuccess: () => void invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const dropRef = useMutation({
    mutationFn: (id: string) => removeReference({ data: { id } }),
    onSuccess: () => {
      toast.success("Referensi dihapus.");
      setSelectedRef(null);
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createDraft = useMutation({
    mutationFn: () =>
      addDraft({
        data: { referenceId: selectedRef!, contentTitle: draftTitle, contentType: draftType },
      }),
    onSuccess: () => {
      toast.success("Draft konten dibuat.");
      setDraftTitle("");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setDraftStatus = useMutation({
    mutationFn: (vars: { id: string; status: WorkflowStatus }) =>
      patchDraft({ data: { id: vars.id, status: vars.status } }),
    onSuccess: () => void invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const dropDraft = useMutation({
    mutationFn: (id: string) => removeDraft({ data: { id } }),
    onSuccess: () => void invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const path = `viral/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage.from("content-research").upload(path, file);
      if (error) throw new Error(error.message);
      setUploadedFile(path);
      setPlatform("upload");
      toast.success("Video terunggah.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  const references = workspace.data?.references ?? [];
  const drafts = workspace.data?.drafts ?? [];
  const active = references.find((r) => r.id === selectedRef) ?? null;

  const stats = useMemo(() => {
    const count = (s: WorkflowStatus) => references.filter((r) => r.status === s).length;
    return {
      total: references.length,
      analyzing: count("analyzing"),
      approved: count("approved") + count("ready_production"),
      drafts: drafts.length,
    };
  }, [references, drafts]);

  return (
    <AppShell>
      <div className="space-y-8">
        <header className="space-y-1">
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight">
            <Brain className="size-6 text-primary" />
            Viral Content Intelligence
          </h1>
          <p className="text-sm text-muted-foreground">
            Kumpulkan referensi viral dari TikTok, Instagram, atau video unggahan, lalu kawal
            statusnya sampai siap produksi.
          </p>
        </header>

        <section className="grid gap-3 sm:grid-cols-4">
          <StatCard label="Total referensi" value={stats.total} />
          <StatCard label="Sedang dianalisis" value={stats.analyzing} />
          <StatCard label="Disetujui / siap produksi" value={stats.approved} />
          <StatCard label="Draft konten" value={stats.drafts} />
        </section>

        <section className="rounded-2xl border border-border/70 bg-card/60 p-5">
          <h2 className="mb-4 font-display text-sm font-semibold">Tambah referensi viral</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Judul referensi</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Hook 3 detik — promo diskon"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Platform</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p === "upload" ? "Video unggahan" : p === "tiktok" ? "TikTok" : "Instagram"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Kategori</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
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
            <div className="space-y-1.5 md:col-span-3">
              <Label>Tautan sumber (opsional bila mengunggah video)</Label>
              <Input
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://www.instagram.com/reel/xxxx/ atau https://www.tiktok.com/@user/video/xxxx"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Unggah video</Label>
              <label className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border/70 text-sm text-muted-foreground hover:border-primary/60 hover:text-foreground">
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <UploadCloud className="size-4" />
                )}
                {uploadedFile ? "Video siap" : "Pilih file"}
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleUpload(f);
                  }}
                />
              </label>
            </div>
          </div>
          <Button
            className="mt-4"
            onClick={() => create.mutate()}
            disabled={create.isPending || uploading}
          >
            {create.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <PlusCircle className="size-4" />
            )}
            Simpan referensi
          </Button>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl border border-border/70 bg-card/60">
            <h2 className="border-b border-border/60 px-5 py-3 font-display text-sm font-semibold">
              Referensi viral
            </h2>
            {workspace.isLoading ? (
              <p className="px-5 py-8 text-sm text-muted-foreground">Memuat…</p>
            ) : references.length === 0 ? (
              <p className="px-5 py-8 text-sm text-muted-foreground">
                Belum ada referensi. Tambahkan tautan viral pertama Anda di atas.
              </p>
            ) : (
              <ul className="divide-y divide-border/60">
                {references.map((r) => (
                  <li
                    key={r.id}
                    className={`flex flex-wrap items-center gap-3 px-5 py-3 ${
                      selectedRef === r.id ? "bg-primary/5" : ""
                    }`}
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => setSelectedRef(r.id)}
                    >
                      <span className="block truncate text-sm font-medium">{r.title}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {r.source_platform} · {r.category ?? "Tanpa kategori"} ·{" "}
                        {new Date(r.created_at).toLocaleString("id-ID")}
                      </span>
                    </button>
                    {r.source_url ? (
                      <a
                        href={r.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted-foreground hover:text-primary"
                      >
                        <ExternalLink className="size-4" />
                      </a>
                    ) : null}
                    <Badge className={STATUS_CLASS[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 text-xs"
                      disabled={analyze.isPending}
                      onClick={() => analyze.mutate(r.id)}
                    >
                      {analyze.isPending && analyze.variables === r.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Wand2 className="size-3.5" />
                      )}
                      Analisis AI
                    </Button>
                    <Select
                      value={r.status}
                      onValueChange={(v) =>
                        setRefStatus.mutate({ id: r.id, status: v as WorkflowStatus })
                      }
                    >
                      <SelectTrigger className="h-8 w-[168px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WORKFLOW_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <button
                      type="button"
                      onClick={() => dropRef.mutate(r.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/60 p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
              <Sparkles className="size-4 text-primary" />
              Draft konten
            </h2>
            {active ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Referensi terpilih: <span className="text-foreground">{active.title}</span>
                </p>
                <Input
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder="Judul draft konten"
                />
                <Select value={draftType} onValueChange={(v) => setDraftType(v as ContentType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {TYPE_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  className="w-full"
                  onClick={() => createDraft.mutate()}
                  disabled={createDraft.isPending}
                >
                  {createDraft.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <PlusCircle className="size-4" />
                  )}
                  Buat draft
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Pilih salah satu referensi untuk membuat draft konten.
              </p>
            )}

            <ul className="mt-5 space-y-2">
              {drafts
                .filter((d) => !active || d.reference_id === active.id)
                .map((d) => (
                  <li
                    key={d.id}
                    className="rounded-xl border border-border/60 bg-background/40 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm">{d.content_title}</span>
                      <button
                        type="button"
                        onClick={() => dropDraft.mutate(d.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {TYPE_LABEL[d.content_type]}
                      </Badge>
                      <Select
                        value={d.status}
                        onValueChange={(v) =>
                          setDraftStatus.mutate({ id: d.id, status: v as WorkflowStatus })
                        }
                      >
                        <SelectTrigger className="h-7 w-[160px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {WORKFLOW_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {STATUS_LABEL[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        </section>

        {(() => {
          const report = (reports.data ?? []).find((x) => x.reference_id === selectedRef);
          if (!selectedRef) return null;
          if (analyze.isPending && analyze.variables === selectedRef) {
            return (
              <section className="flex items-center gap-2 rounded-2xl border border-border/70 bg-card/60 p-5 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-primary" />
                Menganalisis formula viral referensi ini…
              </section>
            );
          }
          if (!report) {
            return (
              <section className="rounded-2xl border border-border/70 bg-card/60 p-5 text-sm text-muted-foreground">
                Belum ada laporan analisis untuk referensi terpilih. Tekan “Analisis AI” pada
                referensi tersebut.
              </section>
            );
          }
          return (
            <section className="space-y-3">
              <ViralAnalysisReportView report={report} />
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => dropReport.mutate(selectedRef)}
                >
                  <Trash2 className="size-3.5" />
                  Hapus laporan
                </Button>
              </div>
            </section>
          );
        })()}

        <section className="grid gap-6 lg:grid-cols-2">
          <Panel
            title="Analisis terbaru"
            empty="Belum ada referensi yang dianalisis."
            items={references
              .filter((r) => r.status === "analyzing" || r.status === "analyzed")
              .slice(0, 5)
              .map((r) => ({ id: r.id, main: r.title, sub: STATUS_LABEL[r.status] }))}
          />
          <Panel
            title="Konten disetujui"
            empty="Belum ada konten yang disetujui."
            items={references
              .filter(
                (r) =>
                  r.status === "approved" ||
                  r.status === "ready_production" ||
                  r.status === "published",
              )
              .slice(0, 5)
              .map((r) => ({ id: r.id, main: r.title, sub: STATUS_LABEL[r.status] }))}
          />
        </section>
      </div>
    </AppShell>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/60 p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
    </div>
  );
}

function Panel({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: { id: string; main: string; sub: string }[];
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/60 p-5">
      <h2 className="mb-3 font-display text-sm font-semibold">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{i.main}</span>
              <span className="text-xs text-muted-foreground">{i.sub}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

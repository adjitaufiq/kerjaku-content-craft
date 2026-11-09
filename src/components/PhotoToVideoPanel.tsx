import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AudioLines,
  BadgeCheck,
  Camera,
  Clock3,
  Copy,
  Film,
  Loader2,
  Move3d,
  Save,
  ShieldX,
  Sparkles,
  TriangleAlert,
  Wind,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  approvePhotoToVideo,
  generatePhotoToVideo,
  getPhotoToVideo,
  savePhotoToVideoDraft,
} from "@/lib/photo-to-video.functions";
import {
  VIDEO_DURATIONS,
  formatScenePrompt,
  formatVideoPackage,
  type PhotoToVideoScene,
  type VideoDuration,
} from "@/lib/photo-to-video.types";

const STATUS_LABEL: Record<string, string> = {
  NOT_GENERATED: "Belum dibuat",
  GENERATING: "Sedang dibuat",
  DRAFT: "Draft tersimpan",
  NEEDS_REVISION: "Perlu perbaikan",
  READY_FOR_REVIEW: "Siap ditinjau",
  APPROVED_VIDEO_PROMPT: "Prompt video disetujui",
  GENERATION_FAILED: "Gagal dibuat",
  CAROUSEL_PROMPT_REQUIRED: "Butuh Prompt Carousel",
};

async function copyText(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} disalin.`);
  } catch {
    toast.error("Browser menolak akses clipboard.");
  }
}

export function PhotoToVideoPanel({ versionId }: { versionId: string }) {
  const queryClient = useQueryClient();
  const load = useServerFn(getPhotoToVideo);
  const generate = useServerFn(generatePhotoToVideo);
  const save = useServerFn(savePhotoToVideoDraft);
  const approve = useServerFn(approvePhotoToVideo);

  const query = useQuery({
    queryKey: ["photo-to-video", versionId],
    queryFn: () => load({ data: { versionId } }),
  });

  const [defaultDuration, setDefaultDuration] = useState<VideoDuration>(8);
  const [scenes, setScenes] = useState<PhotoToVideoScene[]>([]);
  const [canvaNotes, setCanvaNotes] = useState<Record<number, string>>({});
  const slideCount = query.data?.slideCount ?? 0;

  const record = query.data?.record ?? null;
  const status = query.data?.status ?? "NOT_GENERATED";

  useEffect(() => {
    if (record) {
      setScenes(record.scenes ?? []);
      setDefaultDuration(record.default_duration ?? 8);
    }
    const saved = query.data?.canvaNotes;
    if (saved && Object.keys(saved).length) setCanvaNotes(saved);
  }, [record, query.data?.canvaNotes]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["photo-to-video", versionId] });

  const generateMutation = useMutation({
    mutationFn: () => generate({ data: { versionId, defaultDuration, canvaNotes } }),
    onSuccess: async () => {
      await refresh();
      toast.success("Photo-to-Video Prompt selesai dibuat.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveMutation = useMutation({
    mutationFn: () => save({ data: { versionId, scenes } }),
    onSuccess: async () => {
      await refresh();
      toast.success("Draft prompt video tersimpan.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const approveMutation = useMutation({
    mutationFn: () => approve({ data: { versionId } }),
    onSuccess: async () => {
      await refresh();
      toast.success("Photo-to-Video Prompt disetujui.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (status === "CAROUSEL_PROMPT_REQUIRED") {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
        {query.data?.message}
      </div>
    );
  }

  const locked = status === "APPROVED_VIDEO_PROMPT";
  const issues = record?.validation?.issues ?? [];
  const pkg = record?.package ?? null;
  const totalDuration = scenes.reduce((total, scene) => total + scene.duration_seconds, 0);

  const updateScene = (index: number, patch: Partial<PhotoToVideoScene>) =>
    setScenes((current) => current.map((scene, i) => (i === index ? { ...scene, ...patch } : scene)));

  return (
    <div className="space-y-4 rounded-xl border border-border bg-secondary/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 font-display text-sm font-semibold">
          <Film className="size-4 text-primary" /> Output Prompt · Photo-to-Video
        </h4>
        <Badge variant={locked ? "default" : "outline"}>{STATUS_LABEL[status] ?? status}</Badge>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Visual carousel yang sudah ada dipakai sebagai frame awal. Output hanya prompt teks untuk Google Flow,
        Runway, Kling, Luma, Grok Video, dan generator video AI lain. Format tetap 9:16 · 1080x1920.
      </p>

      <div className="space-y-2">
        <Label>Durasi per scene</Label>
        <div className="grid grid-cols-4 gap-1">
          {VIDEO_DURATIONS.map((duration) => (
            <Button
              key={duration}
              type="button"
              size="sm"
              variant={defaultDuration === duration ? "default" : "outline"}
              onClick={() => setDefaultDuration(duration)}
              disabled={locked}
            >
              {duration}s
            </Button>
          ))}
        </div>
      </div>

      {!locked && slideCount > 0 ? (
        <details className="rounded-lg border border-border bg-background/40 p-3 text-xs">
          <summary className="cursor-pointer font-semibold">Visual final Canva per slide (opsional)</summary>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Tulis singkat apa yang tampak di foto Canva Anda (orang, pose, objek, latar, posisi teks). Prompt video akan mengikuti gambar ini.
          </p>
          <div className="mt-2 space-y-2">
            {Array.from({ length: slideCount }, (_, i) => i + 1).map((n) => (
              <div key={n} className="space-y-1">
                <Label className="text-[11px]">Slide {n}</Label>
                <Textarea
                  rows={2}
                  className="text-xs"
                  placeholder="Contoh: wanita berhijab krem duduk di meja kayu, laptop terbuka, judul putih di atas"
                  value={canvaNotes[n] ?? ""}
                  onChange={(e) => setCanvaNotes((c) => ({ ...c, [n]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        </details>
      ) : null}

      <Button
        className="w-full"
        onClick={() => generateMutation.mutate()}
        disabled={generateMutation.isPending || locked}
      >
        {generateMutation.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
        {record ? "Buat Ulang Photo-to-Video" : "Generate Photo-to-Video"}
      </Button>

      {status === "GENERATION_FAILED" && issues.length ? (
        <div className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          <p className="flex items-center gap-2 font-semibold">
            <TriangleAlert className="size-4" /> Pembuatan prompt gagal
          </p>
          <p>{issues[0]?.reason}</p>
          <p className="text-destructive/80">Perbaiki penyebabnya, lalu tekan Buat Ulang Photo-to-Video.</p>
        </div>
      ) : issues.length ? (
        <div className="space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-400">
          <p className="flex items-center gap-2 font-semibold">
            <TriangleAlert className="size-4" /> Validator menemukan {issues.length} catatan
          </p>
          <ul className="list-disc space-y-1 pl-4">
            {issues.map((issue, index) => (
              <li key={`${issue.failed_rule}-${index}`}>
                {issue.affected_scene ? `Scene ${issue.affected_scene}: ` : ""}
                {issue.reason} ({issue.failed_rule})
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {pkg && scenes.length ? (
        <div className="space-y-2 rounded-lg border border-border bg-background/40 p-3 text-xs">
          <p className="font-display text-sm font-semibold">{pkg.video_title}</p>
          <p className="text-muted-foreground"><span className="text-primary">Hook final:</span> {pkg.selected_hook}</p>
          <p className="text-muted-foreground"><span className="text-primary">Payoff:</span> {pkg.payoff}</p>
          <p className="text-muted-foreground"><span className="text-primary">CTA:</span> {pkg.CTA}</p>
          <p className="text-muted-foreground"><span className="text-primary">Character lock:</span> {pkg.character_lock}</p>
          <p className="text-muted-foreground"><span className="text-primary">Product lock:</span> {pkg.product_lock}</p>
          <p className="text-muted-foreground"><span className="text-primary">Environment lock:</span> {pkg.environment_lock}</p>
        </div>
      ) : null}

      {scenes.length ? (
        <div className="space-y-3">
          <section className="overflow-hidden rounded-lg border border-border bg-background/40" aria-label="Preview video">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3">
              <div>
                <p className="flex items-center gap-2 font-display text-sm font-semibold">
                  <Film className="size-4 text-primary" /> Preview Video
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">Ringkasan gerakan dari seluruh slide carousel.</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary"><Clock3 className="mr-1 size-3" />{totalDuration} detik</Badge>
                <Badge variant="outline">{scenes.length} scene</Badge>
                <Badge variant="outline">9:16 · 1080x1920</Badge>
              </div>
            </div>

            <ol className="divide-y divide-border">
              {scenes.map((scene) => (
                <li key={`preview-${scene.scene_number}`} className="space-y-3 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                        {scene.scene_number}
                      </span>
                      <div>
                        <p className="text-xs font-semibold">Scene {scene.scene_number}</p>
                        <p className="text-[11px] text-muted-foreground">Slide {scene.source_carousel_slide} · {scene.narrative_function}</p>
                      </div>
                    </div>
                    <Badge><Clock3 className="mr-1 size-3" />{scene.duration_seconds} detik</Badge>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <PreviewDetail icon={Move3d} label="Gerakan subjek" value={scene.primary_subject_motion} />
                    <PreviewDetail icon={Camera} label="Gerakan kamera" value={scene.camera_motion} />
                    <PreviewDetail icon={Wind} label="Gerakan lingkungan" value={scene.environment_motion} />
                    <PreviewDetail icon={AudioLines} label="Sinkronisasi VO" value={scene.vo_synchronization} />
                  </div>

                  <div className="flex items-start gap-2 rounded-md border border-destructive/25 bg-destructive/5 p-2.5">
                    <ShieldX className="mt-0.5 size-4 shrink-0 text-destructive" />
                    <div>
                      <p className="text-[11px] font-semibold text-destructive">Negative prompt</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{scene.video_negative_prompt}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => pkg && copyText(formatVideoPackage(pkg, scenes), "Paket video lengkap")}
            >
              <Copy /> Copy Full Video Package
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || locked}
            >
              {saveMutation.isPending ? <Loader2 className="animate-spin" /> : <Save />} Simpan Draft
            </Button>
            <Button size="sm" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending || locked}>
              {approveMutation.isPending ? <Loader2 className="animate-spin" /> : <BadgeCheck />} Approve Prompt Video
            </Button>
          </div>

          {scenes.map((scene, index) => (
            <article key={scene.scene_number} className="space-y-2 rounded-lg border border-border bg-background/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase text-primary">
                  Scene {scene.scene_number} · Slide {scene.source_carousel_slide} · {scene.narrative_function}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyText(formatScenePrompt(scene), `Prompt scene ${scene.scene_number}`)}
                >
                  <Copy /> Copy Photo-to-Video Prompt
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-1">
                {VIDEO_DURATIONS.map((duration) => (
                  <Button
                    key={duration}
                    type="button"
                    size="sm"
                    variant={scene.duration_seconds === duration ? "default" : "outline"}
                    onClick={() => updateScene(index, { duration_seconds: duration })}
                    disabled={locked}
                  >
                    {duration}s
                  </Button>
                ))}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <PreviewDetail icon={Move3d} label="Gerakan utama" value={scene.primary_subject_motion} />
                <PreviewDetail icon={Camera} label="Kamera" value={scene.camera_motion} />
                <PreviewDetail icon={Wind} label="Lingkungan" value={scene.environment_motion} />
                <PreviewDetail icon={AudioLines} label="Sinkronisasi VO" value={scene.vo_synchronization} />
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground"><span className="font-semibold text-foreground">Ending frame:</span> {scene.ending_frame}</p>

              <Label className="text-xs">Video prompt (English)</Label>
              <Textarea
                className="font-mono text-xs"
                rows={10}
                value={scene.photo_to_video_prompt}
                onChange={(event) => updateScene(index, { photo_to_video_prompt: event.target.value })}
                disabled={locked}
              />
              <div className="flex items-start gap-2 rounded-md border border-destructive/25 bg-destructive/5 p-2.5">
                <ShieldX className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div>
                  <p className="text-[11px] font-semibold text-destructive">Negative prompt</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{scene.video_negative_prompt}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PreviewDetail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Move3d;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-primary" />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-xs leading-relaxed">{value || "—"}</p>
      </div>
    </div>
  );
}

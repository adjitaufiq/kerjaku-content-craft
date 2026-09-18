import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Copy, Film, Loader2, Save, Sparkles, TriangleAlert } from "lucide-react";
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

  const record = query.data?.record ?? null;
  const status = query.data?.status ?? "NOT_GENERATED";

  useEffect(() => {
    if (record) {
      setScenes(record.scenes ?? []);
      setDefaultDuration(record.default_duration ?? 8);
    }
  }, [record]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["photo-to-video", versionId] });

  const generateMutation = useMutation({
    mutationFn: () => generate({ data: { versionId, defaultDuration } }),
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

              <p className="text-[11px] text-muted-foreground">
                Gerak utama: {scene.primary_subject_motion} · Kamera: {scene.camera_motion} · Lingkungan:{" "}
                {scene.environment_motion}
              </p>
              <p className="text-[11px] text-muted-foreground">Ending frame: {scene.ending_frame}</p>

              <Label className="text-xs">Video prompt (English)</Label>
              <Textarea
                className="font-mono text-xs"
                rows={10}
                value={scene.photo_to_video_prompt}
                onChange={(event) => updateScene(index, { photo_to_video_prompt: event.target.value })}
                disabled={locked}
              />
              <p className="text-[11px] text-muted-foreground">Negative prompt: {scene.video_negative_prompt}</p>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}

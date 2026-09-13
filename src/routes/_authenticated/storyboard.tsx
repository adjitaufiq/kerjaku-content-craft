import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, ArrowLeft, ArrowUp, Copy, Film, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getVideoStoryboard,
  runVideoStoryboard,
  updateStoryboardScenes,
  type StoryboardRecord,
} from "@/lib/video-storyboard.functions";
import type { SceneDuration, StoryboardScene } from "@/lib/video-storyboard.server";

const DURATIONS: SceneDuration[] = [4, 6, 8, 10];

export const Route = createFileRoute("/_authenticated/storyboard")({
  validateSearch: (search: Record<string, unknown>) => ({
    versionId: typeof search["versionId"] === "string" ? search["versionId"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Video Storyboard — KERJAKU Cliper Intelligence" },
      {
        name: "description",
        content:
          "Ubah aset carousel menjadi storyboard photo to video dengan scene bertimeline, durasi terkunci, dan prompt video siap pakai.",
      },
      { property: "og:title", content: "Video Storyboard — KERJAKU Cliper Intelligence" },
      {
        property: "og:description",
        content: "Scene management, durasi 4/6/8/10 detik, prompt video, dan video package KERJAKU.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VideoStoryboardPage,
});

function copyText(value: string) {
  void navigator.clipboard.writeText(value).then(
    () => toast.success("Disalin ke clipboard."),
    () => toast.error("Gagal menyalin."),
  );
}

function VideoStoryboardPage() {
  const { versionId } = Route.useSearch();
  const queryClient = useQueryClient();
  const load = useServerFn(getVideoStoryboard);
  const run = useServerFn(runVideoStoryboard);
  const save = useServerFn(updateStoryboardScenes);

  const query = useQuery({
    queryKey: ["video-storyboard", versionId],
    queryFn: () => load({ data: { versionId } }),
    enabled: Boolean(versionId),
  });

  const generate = useMutation({
    mutationFn: () => run({ data: { versionId } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["video-storyboard", versionId] });
      toast.success("Storyboard video selesai dibuat.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const mutateScenes = useMutation({
    mutationFn: (scenes: StoryboardScene[]) => save({ data: { versionId, scenes } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["video-storyboard", versionId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const version = query.data?.version ?? null;
  const storyboard = query.data?.storyboard ?? null;
  const approved = version?.status === "approved";
  const hasProduction = query.data?.hasProduction ?? false;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
              <Link to="/production" search={{ versionId }}>
                <ArrowLeft /> Kembali ke Content Production
              </Link>
            </Button>
            <h1 className="font-display text-2xl font-semibold">Video Storyboard</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Aset carousel diubah menjadi scene video pendek. Durasi tiap scene dikunci pada 4, 6, 8, atau 10
              detik agar siap dipakai pada generator image-to-video.
            </p>
          </div>
          <Button
            onClick={() => generate.mutate()}
            disabled={!versionId || !approved || !hasProduction || generate.isPending}
          >
            {generate.isPending ? <Loader2 className="animate-spin" /> : <Film />}
            {storyboard ? "Buat Ulang Storyboard" : "Buat Storyboard"}
          </Button>
        </div>

        {!versionId ? (
          <div className="surface-panel p-6 text-sm text-muted-foreground">
            Pilih versi KERJAKU yang sudah punya aset produksi konten untuk membuat storyboard video.
          </div>
        ) : null}

        {version ? (
          <div className="surface-panel flex flex-wrap items-center gap-2 p-4 text-sm">
            <Badge>{version.atm_mode === "conservative" ? "Conservative" : "Creative"}</Badge>
            <Badge variant="outline">{version.status.replace("_", " ")}</Badge>
            <span className="text-muted-foreground">Angle: {version.angle}</span>
          </div>
        ) : null}

        {versionId && version && !hasProduction ? (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-400">
            Aset Content Production belum ada. Buat carousel dan prompt visual dahulu di Content Production.
          </div>
        ) : null}

        {query.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Memuat…
          </div>
        ) : null}

        {storyboard ? (
          <StoryboardView
            storyboard={storyboard}
            busy={mutateScenes.isPending}
            onChange={(scenes) => mutateScenes.mutate(scenes)}
          />
        ) : null}

        {versionId && !storyboard && !query.isLoading ? (
          <div className="surface-panel p-6 text-sm text-muted-foreground">
            Belum ada storyboard video untuk versi ini.
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

function StoryboardView({
  storyboard,
  busy,
  onChange,
}: {
  storyboard: StoryboardRecord;
  busy: boolean;
  onChange: (scenes: StoryboardScene[]) => void;
}) {
  const scenes = storyboard.scenes ?? [];
  const concept = storyboard.video_concept;
  const pkg = storyboard.video_package;

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= scenes.length) return;
    const next = scenes.slice();
    const a = next[index];
    const b = next[target];
    if (!a || !b) return;
    next[index] = b;
    next[target] = a;
    onChange(next);
  };

  const remove = (index: number) => {
    if (scenes.length <= 1) {
      toast.error("Minimal satu scene harus tersisa.");
      return;
    }
    onChange(scenes.filter((_, i) => i !== index));
  };

  const setDuration = (index: number, duration: SceneDuration) => {
    onChange(scenes.map((scene, i) => (i === index ? { ...scene, duration_seconds: duration } : scene)));
  };

  return (
    <div className="space-y-4">
      <div className="surface-panel grid gap-3 p-5 md:grid-cols-2">
        <Field label="Judul video" value={concept?.title ?? ""} />
        <Field label="Story arc" value={concept?.story_arc ?? ""} />
        <Field label="Visual identity" value={concept?.visual_identity ?? ""} />
        <Field label="Pacing" value={concept?.pacing ?? ""} />
        <Field label="Character lock" value={concept?.character_lock ?? ""} />
        <Field label="Brand lock" value={concept?.brand_lock ?? ""} />
        <div className="flex flex-wrap items-center gap-2 md:col-span-2">
          <Badge variant="outline">{concept?.aspect_ratio || "9:16"}</Badge>
          <Badge variant="secondary">{storyboard.scene_count} scene</Badge>
          <Badge variant="secondary">{storyboard.total_duration} detik</Badge>
          {busy ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
        </div>
      </div>

      {scenes.map((scene, index) => (
        <article key={`${scene.scene_number}-${index}`} className="surface-panel space-y-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display font-semibold">Scene {scene.scene_number}</h3>
              <Badge variant="outline">{scene.scene_role}</Badge>
              <Badge variant="secondary">dari slide {scene.source_slide_number}</Badge>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => move(index, -1)}>
                <ArrowUp />
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => move(index, 1)}>
                <ArrowDown />
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => remove(index)}>
                <Trash2 />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => copyText(scene.video_prompt)}>
                <Copy /> Salin prompt
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase text-muted-foreground">Durasi</span>
            {DURATIONS.map((duration) => (
              <Button
                key={duration}
                size="sm"
                variant={scene.duration_seconds === duration ? "default" : "outline"}
                disabled={busy}
                onClick={() => setDuration(index, duration)}
              >
                {duration}s
              </Button>
            ))}
          </div>

          <Field label="Narasi scene" value={scene.narrative} />
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Gerak kamera" value={scene.camera_movement} />
            <Field label="Gerak subjek" value={scene.subject_motion} />
            <Field label="Gerak latar" value={scene.background_motion} />
            <Field label="Audio" value={scene.audio_direction} />
            <Field label="Transisi masuk" value={scene.transition_in} />
            <Field label="Transisi keluar" value={scene.transition_out} />
            <Field label="Teks di layar" value={scene.on_screen_text} />
            <Field label="Consistency lock" value={scene.consistency_lock} />
          </div>
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <Field label="Video prompt" value={scene.video_prompt} />
            <div className="mt-3">
              <Field label="Negative prompt" value={scene.negative_prompt} />
            </div>
          </div>
        </article>
      ))}

      <div className="surface-panel space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display font-semibold">Video Package</h3>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              copyText(
                scenes
                  .map((scene) => `Scene ${scene.scene_number} (${scene.duration_seconds}s): ${scene.video_prompt}`)
                  .join("\n\n"),
              )
            }
          >
            <Copy /> Salin semua prompt
          </Button>
        </div>
        <Field label="Urutan scene" value={(pkg?.scene_order ?? []).join(" → ")} />
        <Field label="Total durasi" value={`${pkg?.total_duration ?? storyboard.total_duration} detik`} />
        <Field label="Catatan penggabungan" value={pkg?.merge_notes ?? ""} />
        <Field label="Arah musik" value={pkg?.music_direction ?? ""} />
        <Field label="Rencana teks/caption" value={pkg?.caption_overlay_plan ?? ""} />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-line text-sm">{value || "—"}</p>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Copy, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getContentProduction,
  runContentProduction,
  type ProductionRecord,
} from "@/lib/content-production.functions";

export const Route = createFileRoute("/_authenticated/production")({
  validateSearch: (search: Record<string, unknown>) => ({
    versionId: typeof search["versionId"] === "string" ? search["versionId"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Content Production — KERJAKU Cliper Intelligence" },
      {
        name: "description",
        content:
          "Ubah versi KERJAKU yang disetujui menjadi carousel, prompt visual, caption, CTA, dan hashtag siap produksi.",
      },
      { property: "og:title", content: "Content Production — KERJAKU Cliper Intelligence" },
      {
        property: "og:description",
        content: "Carousel, prompt visual, caption, CTA, dan hashtag dari versi KERJAKU yang disetujui.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContentProductionPage,
});

function copyText(value: string) {
  void navigator.clipboard.writeText(value).then(
    () => toast.success("Disalin ke clipboard."),
    () => toast.error("Gagal menyalin."),
  );
}

function ContentProductionPage() {
  const { versionId } = Route.useSearch();
  const queryClient = useQueryClient();
  const load = useServerFn(getContentProduction);
  const run = useServerFn(runContentProduction);

  const query = useQuery({
    queryKey: ["content-production", versionId],
    queryFn: () => load({ data: { versionId } }),
    enabled: Boolean(versionId),
  });

  const generate = useMutation({
    mutationFn: () => run({ data: { versionId } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["content-production", versionId] });
      toast.success("Aset produksi konten selesai dibuat.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const version = query.data?.version ?? null;
  const production = query.data?.production ?? null;
  const approved = version?.status === "approved";

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
              <Link to="/sources">
                <ArrowLeft /> Kembali ke Viral Source
              </Link>
            </Button>
            <h1 className="font-display text-2xl font-semibold">Content Production</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Aset produksi dibuat dari KERJAKU Version Report, Viral DNA, Source Mapping, dan Brand Knowledge.
              Fakta tidak boleh keluar dari sumber yang diizinkan mode ATM.
            </p>
          </div>
          <Button
            onClick={() => generate.mutate()}
            disabled={!versionId || !approved || generate.isPending}
          >
            {generate.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {production ? "Buat Ulang Aset" : "Buat Aset Produksi"}
          </Button>
        </div>

        {!versionId ? (
          <div className="surface-panel p-6 text-sm text-muted-foreground">
            Pilih versi KERJAKU yang sudah disetujui dari halaman detail sumber untuk memulai produksi.
          </div>
        ) : null}

        {version ? (
          <div className="surface-panel flex flex-wrap items-center gap-2 p-4 text-sm">
            <Badge>{version.atm_mode === "conservative" ? "Conservative" : "Creative"}</Badge>
            <Badge variant="outline">{version.status.replace("_", " ")}</Badge>
            <span className="text-muted-foreground">Angle: {version.angle}</span>
          </div>
        ) : null}

        {versionId && version && !approved ? (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-400">
            Versi ini belum disetujui. Setujui arah ATM terlebih dahulu di halaman detail sumber.
          </div>
        ) : null}

        {query.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Memuat…
          </div>
        ) : null}

        {production ? <ProductionTabs production={production} /> : null}
        {versionId && !production && !query.isLoading ? (
          <div className="surface-panel p-6 text-sm text-muted-foreground">
            Belum ada aset produksi untuk versi ini.
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

function ProductionTabs({ production }: { production: ProductionRecord }) {
  const info = production.content_info;
  return (
    <div className="space-y-4">
      <div className="surface-panel grid gap-3 p-5 md:grid-cols-2">
        <Field label="Judul" value={info?.title ?? ""} />
        <Field label="Content angle" value={info?.content_angle ?? ""} />
        <Field label="Target audience" value={info?.target_audience ?? ""} />
        <Field label="Objective" value={info?.objective ?? ""} />
      </div>

      <Tabs defaultValue="carousel">
        <TabsList className="flex w-full flex-wrap justify-start">
          <TabsTrigger value="carousel">Carousel</TabsTrigger>
          <TabsTrigger value="visual">Visual Prompt</TabsTrigger>
          <TabsTrigger value="caption">Caption</TabsTrigger>
          <TabsTrigger value="cta">CTA</TabsTrigger>
          <TabsTrigger value="hashtag">Hashtag</TabsTrigger>
        </TabsList>

        <TabsContent value="carousel" className="space-y-3">
          {(production.carousel_structure ?? []).map((slide) => (
            <article key={slide.slide_number} className="surface-panel space-y-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display font-semibold">Slide {slide.slide_number}</h3>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{slide.objective}</Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyText(`${slide.headline}\n\n${slide.body_text}`)}
                  >
                    <Copy /> Salin
                  </Button>
                </div>
              </div>
              <Field label="Headline" value={slide.headline} />
              <Field label="Body" value={slide.body_text} />
              <Field label="Arah visual" value={slide.visual_direction} />
              <Field label="CTA" value={slide.cta} />
              {slide.slide_number === 1 ? (
                <div className="grid gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 md:grid-cols-2">
                  <Field label="Hook" value={slide.hook} />
                  <Field label="Pattern interrupt" value={slide.pattern_interrupt} />
                  <Field label="Psychological trigger" value={slide.psychological_trigger} />
                  <Field label="Curiosity gap" value={slide.curiosity_gap} />
                  <div className="md:col-span-2">
                    <p className="text-xs font-semibold uppercase text-primary">Power words</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(slide.power_words ?? []).map((word) => (
                        <Badge key={word} variant="secondary">
                          {word}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
              {(slide.source_refs ?? []).length ? (
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Asal informasi</p>
                  <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                    {slide.source_refs.map((ref, index) => (
                      <li key={`${slide.slide_number}-${index}`}>
                        <span className="font-mono text-primary">
                          {ref.origin === "brand_knowledge" ? "Brand Knowledge" : ref.timestamp}
                        </span>{" "}
                        · {ref.detail}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </article>
          ))}
        </TabsContent>

        <TabsContent value="visual" className="space-y-3">
          {(production.visual_prompts ?? []).map((prompt) => (
            <article key={prompt.slide_number} className="surface-panel space-y-3 p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display font-semibold">Slide {prompt.slide_number}</h3>
                <Button size="sm" variant="ghost" onClick={() => copyText(promptText(prompt))}>
                  <Copy /> Salin prompt
                </Button>
              </div>
              <Field label="Scene" value={prompt.scene_description} />
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Visual style" value={prompt.visual_style} />
                <Field label="Composition" value={prompt.composition} />
                <Field label="Camera angle" value={prompt.camera_angle} />
                <Field label="Lighting" value={prompt.lighting} />
                <Field label="Mood" value={prompt.mood} />
                <Field label="Aspect ratio" value={prompt.aspect_ratio} />
                <Field label="Teks dalam gambar" value={prompt.text_in_image} />
                <Field label="Negative prompt" value={prompt.negative_prompt} />
              </div>
            </article>
          ))}
        </TabsContent>

        <TabsContent value="caption" className="space-y-3">
          {(production.caption_options ?? []).map((caption, index) => (
            <article key={`${caption.caption_angle}-${index}`} className="surface-panel space-y-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge>{caption.caption_angle}</Badge>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{caption.char_count} karakter</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      copyText(`${caption.hook}\n\n${caption.body}\n\n${caption.cta}\n\n${caption.hashtag}`)
                    }
                  >
                    <Copy /> Salin
                  </Button>
                </div>
              </div>
              <Field label="Hook" value={caption.hook} />
              <Field label="Body" value={caption.body} />
              <Field label="CTA" value={caption.cta} />
              <Field label="Hashtag" value={caption.hashtag} />
            </article>
          ))}
        </TabsContent>

        <TabsContent value="cta" className="space-y-3">
          {(production.cta_options ?? []).map((cta, index) => (
            <article key={`${cta.cta_type}-${index}`} className="surface-panel flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <Badge variant="outline">{cta.cta_type}</Badge>
                <p className="mt-2 text-sm">{cta.cta_text}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => copyText(cta.cta_text)}>
                <Copy /> Salin
              </Button>
            </article>
          ))}
        </TabsContent>

        <TabsContent value="hashtag" className="space-y-3">
          <HashtagGroup label="Broad" items={production.hashtags?.broad ?? []} />
          <HashtagGroup label="Niche" items={production.hashtags?.niche ?? []} />
          <HashtagGroup label="Brand" items={production.hashtags?.brand ?? []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function promptText(prompt: ProductionRecord["visual_prompts"][number]) {
  return [
    prompt.scene_description,
    prompt.visual_style,
    prompt.composition,
    prompt.camera_angle,
    prompt.lighting,
    prompt.mood,
    `aspect ratio ${prompt.aspect_ratio}`,
    `text in image: ${prompt.text_in_image}`,
    `negative prompt: ${prompt.negative_prompt}`,
  ]
    .filter(Boolean)
    .join(", ");
}

function HashtagGroup({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="surface-panel space-y-3 p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase text-primary">{label}</p>
        <Button size="sm" variant="ghost" onClick={() => copyText(items.join(" "))}>
          <Copy /> Salin
        </Button>
      </div>
      <div className="flex flex-wrap gap-1">
        {items.map((tag) => (
          <Badge key={tag} variant="secondary">
            {tag}
          </Badge>
        ))}
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

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Copy, ImageIcon, Loader2, Save, Sparkles, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  approveCarouselPrompt,
  generateCarouselPrompt,
  getCarouselPrompt,
  saveCarouselPromptDraft,
} from "@/lib/carousel-prompt.functions";
import {
  VISUAL_STYLE_OPTIONS,
  type CarouselPromptSlide,
  type CarouselTextLevel,
} from "@/lib/carousel-prompt.types";

const STATUS_LABEL: Record<string, string> = {
  NOT_GENERATED: "Belum dibuat",
  GENERATING: "Sedang dibuat",
  DRAFT: "Draft tersimpan",
  NEEDS_REVISION: "Perlu perbaikan",
  READY_FOR_REVIEW: "Siap ditinjau",
  APPROVED_PROMPT: "Prompt disetujui",
  GENERATION_FAILED: "Gagal dibuat",
  SELECTED_CONCEPT_REQUIRED: "Butuh konsep terpilih",
};

async function copyText(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} disalin.`);
  } catch {
    toast.error("Browser menolak akses clipboard.");
  }
}

export function CarouselPromptPanel({ versionId }: { versionId: string }) {
  const queryClient = useQueryClient();
  const load = useServerFn(getCarouselPrompt);
  const generate = useServerFn(generateCarouselPrompt);
  const save = useServerFn(saveCarouselPromptDraft);
  const approve = useServerFn(approveCarouselPrompt);

  const query = useQuery({
    queryKey: ["carousel-prompt", versionId],
    queryFn: () => load({ data: { versionId } }),
  });

  const [slideCount, setSlideCount] = useState<5 | 7 | 10>(7);
  const [visualStyle, setVisualStyle] = useState<string>("brand_center");
  const [customStyle, setCustomStyle] = useState("");
  const [textLevel, setTextLevel] = useState<CarouselTextLevel>("sedang");
  const [slides, setSlides] = useState<CarouselPromptSlide[]>([]);

  const record = query.data?.record ?? null;
  const status = query.data?.status ?? "NOT_GENERATED";

  useEffect(() => {
    if (record) {
      setSlides(record.slides ?? []);
      setSlideCount((record.slide_count as 5 | 7 | 10) ?? 7);
      setTextLevel(record.text_level);
      const known = VISUAL_STYLE_OPTIONS.some((option) => option.value === record.visual_style);
      setVisualStyle(known ? record.visual_style : "custom");
      if (!known) setCustomStyle(record.visual_style);
    }
  }, [record]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["carousel-prompt", versionId] });

  const generateMutation = useMutation({
    mutationFn: () =>
      generate({
        data: {
          versionId,
          slideCount,
          visualStyle: visualStyle === "custom" ? customStyle.trim() || "custom" : visualStyle,
          textLevel,
        },
      }),
    onSuccess: async () => {
      await refresh();
      toast.success("Prompt Carousel selesai dibuat.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveMutation = useMutation({
    mutationFn: () => save({ data: { versionId, slides } }),
    onSuccess: async () => {
      await refresh();
      toast.success("Draft prompt tersimpan.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const approveMutation = useMutation({
    mutationFn: () => approve({ data: { versionId } }),
    onSuccess: async () => {
      await refresh();
      toast.success("Prompt Carousel disetujui.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (status === "SELECTED_CONCEPT_REQUIRED") {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
        {query.data?.message}
      </div>
    );
  }

  const locked = status === "APPROVED_PROMPT";
  const issues = record?.validation?.issues ?? [];
  const pkg = record?.package ?? null;

  const updateSlide = (index: number, patch: Partial<CarouselPromptSlide>) =>
    setSlides((current) => current.map((slide, i) => (i === index ? { ...slide, ...patch } : slide)));

  const allPromptsText = slides
    .map((slide) => `Slide ${slide.slide_number}\n${slide.image_prompt}\nNegative: ${slide.negative_prompt}`)
    .join("\n\n");

  return (
    <div className="space-y-4 rounded-xl border border-border bg-secondary/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 font-display text-sm font-semibold">
          <ImageIcon className="size-4 text-primary" /> Output Prompt · Text-to-Photo Carousel
        </h4>
        <Badge variant={locked ? "default" : "outline"}>{STATUS_LABEL[status] ?? status}</Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-2">
          <Label>Jumlah slide</Label>
          <div className="grid grid-cols-3 gap-1">
            {[5, 7, 10].map((count) => (
              <Button
                key={count}
                type="button"
                size="sm"
                variant={slideCount === count ? "default" : "outline"}
                onClick={() => setSlideCount(count as 5 | 7 | 10)}
                disabled={locked}
              >
                {count}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="carousel-style">Visual style</Label>
          <select
            id="carousel-style"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={visualStyle}
            onChange={(event) => setVisualStyle(event.target.value)}
            disabled={locked}
          >
            {VISUAL_STYLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {visualStyle === "custom" ? (
            <Input
              value={customStyle}
              onChange={(event) => setCustomStyle(event.target.value)}
              placeholder="Tulis gaya visual yang diinginkan"
              disabled={locked}
            />
          ) : null}
        </div>
        <div className="space-y-2">
          <Label>Tingkat teks</Label>
          <div className="grid grid-cols-3 gap-1">
            {(["singkat", "sedang", "detail"] as CarouselTextLevel[]).map((level) => (
              <Button
                key={level}
                type="button"
                size="sm"
                variant={textLevel === level ? "default" : "outline"}
                onClick={() => setTextLevel(level)}
                disabled={locked}
              >
                {level}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">Format tetap Instagram Carousel 4:5 · 1080x1350 piksel.</p>

      <Button className="w-full" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending || locked}>
        {generateMutation.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
        {record ? "Buat Ulang Prompt Carousel" : "Generate Prompt Carousel"}
      </Button>

      {issues.length ? (
        <div className="space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-400">
          <p className="flex items-center gap-2 font-semibold">
            <TriangleAlert className="size-4" /> Validator menemukan {issues.length} catatan
          </p>
          <ul className="list-disc space-y-1 pl-4">
            {issues.map((issue, index) => (
              <li key={`${issue.failed_rule}-${index}`}>
                {issue.affected_slide ? `Slide ${issue.affected_slide}: ` : ""}
                {issue.reason} ({issue.failed_rule})
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {pkg ? (
        <div className="space-y-2 rounded-lg border border-border bg-background/40 p-3 text-xs">
          <p className="font-display text-sm font-semibold">{pkg.carousel_title}</p>
          <p className="text-muted-foreground"><span className="text-primary">Hook final:</span> {pkg.selected_hook}</p>
          <p className="text-muted-foreground"><span className="text-primary">Problem:</span> {pkg.main_problem}</p>
          <p className="text-muted-foreground"><span className="text-primary">Solution:</span> {pkg.main_solution}</p>
          <p className="text-muted-foreground"><span className="text-primary">Payoff:</span> {pkg.payoff}</p>
          <p className="text-muted-foreground"><span className="text-primary">CTA:</span> {pkg.CTA}</p>
          <p className="text-muted-foreground"><span className="text-primary">Konsistensi visual:</span> {pkg.character_lock}</p>
        </div>
      ) : null}

      {slides.length ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => copyText(allPromptsText, "Semua prompt")}>
              <Copy /> Salin semua prompt
            </Button>
            <Button size="sm" variant="outline" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || locked}>
              {saveMutation.isPending ? <Loader2 className="animate-spin" /> : <Save />} Simpan Draft
            </Button>
            <Button size="sm" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending || locked}>
              {approveMutation.isPending ? <Loader2 className="animate-spin" /> : <BadgeCheck />} Approve Prompt Carousel
            </Button>
          </div>

          {slides.map((slide, index) => (
            <article key={slide.slide_number} className="space-y-2 rounded-lg border border-border bg-background/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase text-primary">
                  Slide {slide.slide_number} · {slide.narrative_function}
                </p>
                <Button size="sm" variant="ghost" onClick={() => copyText(slide.image_prompt, `Prompt slide ${slide.slide_number}`)}>
                  <Copy /> Salin prompt
                </Button>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Headline</Label>
                <Input value={slide.headline} onChange={(event) => updateSlide(index, { headline: event.target.value })} disabled={locked} />
                <Label className="text-xs">Teks pendukung</Label>
                <Textarea value={slide.supporting_text} onChange={(event) => updateSlide(index, { supporting_text: event.target.value })} disabled={locked} />
                <Label className="text-xs">Image prompt (English)</Label>
                <Textarea className="font-mono text-xs" rows={4} value={slide.image_prompt} onChange={(event) => updateSlide(index, { image_prompt: event.target.value })} disabled={locked} />
                <p className="text-[11px] text-muted-foreground">Negative prompt: {slide.negative_prompt}</p>
                <p className="text-[11px] text-muted-foreground">Ruang teks: {slide.text_safe_area} · {slide.camera_shot} · {slide.lighting}</p>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}

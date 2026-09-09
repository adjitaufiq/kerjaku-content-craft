import { useState } from "react";
import { Check, Copy, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ContentRemixRow } from "@/lib/content-remix.functions";

function CopyButton({ value, label = "Salin" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 shrink-0 gap-1 px-2 text-[11px]"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Tidak bisa menyalin teks.");
        }
      }}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? "Tersalin" : label}
    </Button>
  );
}

function Block({ title, value }: { title: string; value: string }) {
  if (!value) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{title}</p>
        <CopyButton value={value} />
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{value}</p>
    </div>
  );
}

export function ContentRemixView({ remix }: { remix: ContentRemixRow }) {
  const slidesText = remix.slides
    .map((s) => `Slide ${s.slide_number} — ${s.purpose}\n${s.text}`)
    .join("\n\n");
  const hashtagsText = remix.hashtags.join(" ");
  const fullText = [
    `Angle: ${remix.content_angle}`,
    `Struktur: ${remix.structure_type}`,
    "",
    slidesText,
    "",
    "Caption:",
    ...remix.captions.map((c, i) => `${i + 1}. (${c.style}) ${c.text}`),
    "",
    `Hashtag: ${hashtagsText}`,
    "",
    "CTA:",
    ...remix.ctas.map((c) => `- ${c.type}: ${c.text}`),
  ].join("\n");

  return (
    <div className="rounded-2xl border border-border/70 bg-card/60">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-3">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
          <Sparkles className="size-4 text-primary" />
          KERJAKU Content Remix
        </h2>
        <CopyButton value={fullText} label="Salin semua" />
      </div>

      <div className="space-y-5 p-5">
        <div className="grid gap-3 md:grid-cols-2">
          <Block title="Content Angle" value={remix.content_angle} />
          <Block title="Kenapa Angle Ini" value={remix.angle_rationale} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            Struktur: {remix.structure_type || "-"}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            Format: {remix.content_type}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {remix.slides.length} slide
          </Badge>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-display text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Struktur konten
            </h3>
            <CopyButton value={slidesText} label="Salin struktur" />
          </div>
          <div className="space-y-2">
            {remix.slides.map((s) => (
              <div
                key={s.slide_number}
                className="rounded-xl border border-border/60 bg-background/40 p-3"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-medium text-primary">
                    Slide {s.slide_number} · {s.purpose}
                  </p>
                  <CopyButton value={s.text} />
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-2 font-display text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            5 opsi caption
          </h3>
          <div className="space-y-2">
            {remix.captions.map((c, i) => (
              <div
                key={`${c.style}-${i}`}
                className="rounded-xl border border-border/60 bg-background/40 p-3"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Opsi {i + 1} · {c.style}
                  </p>
                  <CopyButton value={c.text} />
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{c.text}</p>
              </div>
            ))}
          </div>
        </div>

        <Block title="Rekomendasi hashtag" value={hashtagsText} />

        <div>
          <h3 className="mb-2 font-display text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            CTA engagement
          </h3>
          <div className="grid gap-2 md:grid-cols-2">
            {remix.ctas.map((c, i) => (
              <div
                key={`${c.type}-${i}`}
                className="rounded-xl border border-border/60 bg-background/40 p-3"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-medium text-primary">{c.type}</p>
                  <CopyButton value={c.text} />
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{c.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-2 font-display text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Content quality check
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            <Block title="Pattern Interrupt" value={remix.quality_check?.pattern_interrupt ?? ""} />
            <Block
              title="Psychological Trigger"
              value={remix.quality_check?.psychological_trigger ?? ""}
            />
            <Block title="Curiosity Gap" value={remix.quality_check?.curiosity_gap ?? ""} />
            <Block title="Power Word" value={remix.quality_check?.power_word ?? ""} />
          </div>
        </div>
      </div>
    </div>
  );
}

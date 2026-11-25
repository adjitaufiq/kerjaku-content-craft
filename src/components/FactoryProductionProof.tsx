import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import image from "@/assets/factory-connected/poster.png.asset.json";
import voice from "@/assets/factory-connected/voice.mp3.asset.json";
import video from "@/assets/factory-connected/video.mp4.asset.json";
import bundle from "@/assets/factory-connected/bundle.zip.asset.json";
import slide1 from "@/assets/factory-connected/carousel-01.png.asset.json";
import slide2 from "@/assets/factory-connected/carousel-02.png.asset.json";
import slide3 from "@/assets/factory-connected/carousel-03.png.asset.json";
import slide4 from "@/assets/factory-connected/carousel-04.png.asset.json";
import slide5 from "@/assets/factory-connected/carousel-05.png.asset.json";
import slide6 from "@/assets/factory-connected/carousel-06.png.asset.json";
import slide7 from "@/assets/factory-connected/carousel-07.png.asset.json";
const slides = [slide1, slide2, slide3, slide4, slide5, slide6, slide7];

export function FactoryProductionProof() {
  return (
    <section className="mt-10 space-y-4 border-t border-border pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-lg font-semibold">Hasil uji produksi KERJAKU</h3>
        <Badge variant="outline">Integrasi lokal · Belum dipublikasikan</Badge>
      </div>
      <div className="grid gap-5 sm:grid-cols-[1fr_1fr]">
        <figure>
          <img
            src={image.url}
            alt="Poster edukasi KERJAKU: AI Automation, otomatisasi pekerjaan berulang dengan persetujuan manusia"
            className="max-h-[520px] w-full object-contain"
          />
          <figcaption className="mt-2 text-xs text-muted-foreground">
            Poster PNG · Tipografi hasil produksi
          </figcaption>
        </figure>
        <div className="space-y-4">
          <video
            src={video.url}
            controls
            playsInline
            preload="metadata"
            className="max-h-[520px] w-full bg-muted"
          />
          <div className="text-xs text-muted-foreground">
            MP4 vertikal · VO Indonesia · Subtitle tertanam
          </div>
          <audio src={voice.url} controls preload="metadata" className="w-full" />
          <p className="text-xs text-muted-foreground">
            MP3 · Suara sintetis Economy. Riset, respons AI dan penyimpanan memakai fixture uji;
            antrean, render, subtitle dan berkas media dijalankan nyata secara lokal, bukan
            publikasi live.
          </p>
        </div>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-3" aria-label="Carousel hasil integrasi lokal">
        {slides.map((slide, index) => (
          <figure key={slide.asset_id} className="w-48 shrink-0">
            <img
              src={slide.url}
              alt={`Slide carousel KERJAKU ${index + 1} dari 7`}
              className="aspect-[4/5] w-full object-contain"
              loading="lazy"
            />
            <figcaption className="mt-2 text-xs text-muted-foreground">
              Slide {index + 1} / 7
            </figcaption>
          </figure>
        ))}
      </div>
      <Button asChild variant="outline">
        <a href={bundle.url} download="kerjaku-integrasi-lokal.zip">
          <Download className="size-4" />
          Unduh paket uji lokal
        </a>
      </Button>
    </section>
  );
}

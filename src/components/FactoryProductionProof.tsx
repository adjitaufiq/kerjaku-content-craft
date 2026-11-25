import { Badge } from "@/components/ui/badge";
import image from "@/assets/factory-proof/image.png.asset.json";
import voice from "@/assets/factory-proof/voice.mp3.asset.json";
import video from "@/assets/factory-proof/video.mp4.asset.json";

export function FactoryProductionProof() {
  return (
    <section className="mt-10 space-y-4 border-t border-border pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-lg font-semibold">Hasil uji produksi KERJAKU</h3>
        <Badge variant="outline">Uji lokal · Belum dipublikasikan</Badge>
      </div>
      <div className="grid gap-5 sm:grid-cols-[1fr_1fr]">
        <figure>
          <img
            src={image.url}
            alt="Poster edukasi KERJAKU: AI Automation, otomatisasi pekerjaan berulang dengan persetujuan manusia"
            className="max-h-[520px] w-full object-contain"
          />
          <figcaption className="mt-2 text-xs text-muted-foreground">
            PNG · Gambar AI nyata
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
            MP3 · Suara sintetis Economy. Hasil uji terpisah, bukan bukti campaign atau publikasi
            live.
          </p>
        </div>
      </div>
    </section>
  );
}

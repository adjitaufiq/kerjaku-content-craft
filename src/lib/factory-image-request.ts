import type { BankContent } from "./content-bank";
import { readScenes } from "./factory-plan";
export function campaignImageRequest(content: BankContent, index: number) {
  const scenes = readScenes(content);
  const scene = scenes[index % scenes.length];
  if (!scene) throw new Error("Scene missing");
  return {
    model: "openai/gpt-image-2.5-sunburst" as const,
    output_format: "png" as const,
    size: "1024x1536" as const,
    prompt: `Visual produksi KERJAKU. ${scene.visual}. Narasi scene: ${scene.narration}. Arahan keseluruhan: ${content.prompt}. Konsistensi fotografi/editorial modern, objek jelas dan relevan dengan narasi, cahaya terang, komposisi vertikal dengan ruang kosong untuk tipografi. Jangan masukkan teks, huruf, watermark, angka, atau logo dalam gambar: tipografi dirender terpisah secara akurat. Jangan membuat klaim visual palsu atau grafik metrik. Scene ${index + 1}/${scenes.length}, berbeda dari scene lain.`,
  };
}
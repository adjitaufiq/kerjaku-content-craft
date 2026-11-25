import { FACTORY_STAGES, type FactoryAsset } from "./factory-types";
export function nextFactoryStage(stage: string, format = "Video", formats = [format]): string {
  if (stage === "image") return formats.some((f) => f !== "Video") ? "design" : "voice";
  if (stage === "design") return formats.includes("Video") ? "voice" : "quality";
  const index = FACTORY_STAGES.findIndex((s) => s === stage);
  if (index < 0) throw new Error("Unknown factory stage");
  return FACTORY_STAGES[index + 1] ?? "complete";
}
export function qualityCheckBundle(assets: FactoryAsset[], voiceOver: string, formats: string[], slides: number) {
  const issues: string[] = [];
  const has = (name: string) => assets.some((a) => a.path.endsWith(`/${name}`) && a.bytes > 0 && /^[a-f0-9]{64}$/.test(a.checksum));
  if (formats.includes("Foto") && (!has("poster.png") || !has("poster.jpg"))) issues.push("Poster PNG/JPG belum lengkap");
  if (formats.includes("Carousel")) for (let i = 1; i <= slides; i++) if (!has(`carousel-${String(i).padStart(2, "0")}.png`)) issues.push(`Slide carousel ${i} belum lengkap`);
  if (formats.includes("Video")) {
    issues.push(...qualityCheck(assets, voiceOver, "Video").issues);
    if (!has("subtitles.ass") || !has("alignment.json")) issues.push("Subtitle word-level ASS belum lengkap");
  }
  return { passed: issues.length === 0, issues };
}
export function qualityCheck(
  assets: FactoryAsset[],
  voiceOver: string,
  format = "Video",
  imageCount = 1,
): { passed: boolean; issues: string[] } {
  const issues: string[] = [];
  if (format === "Video" && !voiceOver.trim()) issues.push("Narasi kosong");
  const expected: FactoryAsset["kind"][] =
    format === "Video" ? ["image", "voice", "subtitle", "video"] : ["image"];
  for (const kind of expected)
    if (!assets.some((a) => a.kind === kind && a.bytes > 0 && a.checksum.length === 64))
      issues.push(`Aset ${kind} belum terverifikasi`);
  if (
    assets.filter((a) => a.kind === "image" && a.bytes > 0 && a.checksum.length === 64).length <
    imageCount
  )
    issues.push("Jumlah gambar belum lengkap");
  const voice = assets.find((a) => a.kind === "voice");
  const video = assets.find((a) => a.kind === "video");
  if (
    format === "Video" &&
    (!voice?.duration || !video?.duration || Math.abs(voice.duration - video.duration) > 1)
  )
    issues.push("Durasi video dan suara tidak sinkron");
  return { passed: issues.length === 0, issues };
}
export function mayReplayFactoryTask(state: string, outcome: string): boolean {
  return state !== "running" && outcome === "not_started";
}

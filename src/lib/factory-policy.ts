import { FACTORY_STAGES, type FactoryAsset } from "./factory-types";
export function nextFactoryStage(stage: string, format = "Video"): string {
  if (stage === "image" && format !== "Video") return "quality";
  const index = FACTORY_STAGES.findIndex((s) => s === stage);
  if (index < 0) throw new Error("Unknown factory stage");
  return FACTORY_STAGES[index + 1] ?? "complete";
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

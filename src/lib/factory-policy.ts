import { FACTORY_STAGES, type FactoryAsset } from "./factory-types";
export function nextFactoryStage(stage: string): string {
  const index = FACTORY_STAGES.findIndex((s) => s === stage);
  if (index < 0) throw new Error("Unknown factory stage");
  return FACTORY_STAGES[index + 1] ?? "complete";
}
export function qualityCheck(assets: FactoryAsset[], voiceOver: string): { passed: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!voiceOver.trim()) issues.push("Narasi kosong");
  for (const kind of ["image", "voice", "subtitle", "video"] as const) if (!assets.some((a) => a.kind === kind && a.bytes > 0 && a.checksum.length === 64)) issues.push(`Aset ${kind} belum terverifikasi`);
  const voice = assets.find((a) => a.kind === "voice"); const video = assets.find((a) => a.kind === "video");
  if (!voice?.duration || !video?.duration || Math.abs(voice.duration - video.duration) > 1) issues.push("Durasi video dan suara tidak sinkron");
  return { passed: issues.length === 0, issues };
}
export function mayReplayFactoryTask(state: string, outcome: string): boolean {
  return state !== "running" && outcome === "not_started";
}
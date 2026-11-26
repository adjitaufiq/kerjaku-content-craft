import type { BankContent } from "./content-bank";
import type { DistributionPackage, FactoryAsset, TaskOutput } from "./factory-types";

export type ResultMedia = Omit<FactoryAsset, "kind"> & {
  kind: string;
  id: string;
  task_id: string;
  campaign_id: string;
  created_at: string;
};
export type FactoryResult = {
  id: string;
  campaignId: string;
  ordinal: number;
  title: string;
  caption: string;
  hashtags: string;
  status: "ready" | "processing" | "blocked" | "review";
  formats: { poster: ResultMedia[]; carousel: ResultMedia[]; video: ResultMedia[] };
  distribution: {
    id: string;
    platform: string;
    format: string;
    state: string;
    reason: string | null;
    postUrl: string | null;
  }[];
};

type ResultTask = {
  id: string;
  campaign_id: string;
  ordinal: number;
  stage: string;
  state: string;
  output: unknown;
};
type ResultDistribution = {
  id: string;
  task_id: string;
  platform: string;
  format: string;
  state: string;
  reason: string | null;
  post_url: string | null;
  package: DistributionPackage;
};

// Only finalized render outputs belong in the result gallery; scene source images stay in operations.
export function buildFactoryResults(
  tasks: ResultTask[],
  media: ResultMedia[],
  distribution: ResultDistribution[],
  bank: BankContent[],
): FactoryResult[] {
  return tasks.map((task) => {
    const output = task.output as TaskOutput | null;
    const content = output?.content;
    const document = bank.find((row) => row.id === content?.id) ?? content;
    const packages = distribution.filter((row) => row.task_id === task.id);
    const assets = media.filter((asset) => asset.task_id === task.id);
    const formats = {
      poster: assets.filter((asset) => /\/poster\.(png|jpg)$/.test(asset.path)),
      carousel: assets
        .filter((asset) => /\/carousel-\d+\.png$/.test(asset.path))
        .sort((a, b) => a.path.localeCompare(b.path)),
      video: assets.filter((asset) => asset.kind === "video" && asset.mime === "video/mp4"),
    };
    const held = ["blocked", "reconciliation_required", "failed"].includes(task.state);
    const hasMedia = formats.poster.length + formats.carousel.length + formats.video.length > 0;
    const qcPassed = output?.qc?.passed === true;
    return {
      id: task.id,
      campaignId: task.campaign_id,
      ordinal: task.ordinal,
      title: document?.title ?? packages[0]?.package.title ?? `Konten ${task.ordinal}`,
      caption: document?.caption ?? packages[0]?.package.caption ?? "",
      hashtags: document?.production.hashtags ?? packages[0]?.package.hashtags ?? "",
      status: held
        ? "blocked"
        : qcPassed && hasMedia
          ? "ready"
          : hasMedia
            ? "review"
            : "processing",
      formats,
      distribution: packages.map((row) => ({
        id: row.id,
        platform: row.platform,
        format: row.format,
        state: row.state,
        reason: row.reason,
        postUrl: row.post_url,
      })),
    };
  });
}

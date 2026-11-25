import { z } from "zod";
import type { BankContent } from "./content-bank";
import { contentSchema } from "./content-bank";

export const FACTORY_STAGES = [
  "research",
  "script",
  "image",
  "voice",
  "render",
  "quality",
  "distribution",
  "analytics",
] as const;
export const campaignSchema = z.object({
  command: z.string().min(10).max(3000),
  count: z.number().int().min(1).max(100),
  audience: z.string().min(1),
  platforms: z.array(z.enum(["instagram", "tiktok", "facebook", "youtube"])).min(1),
  mode: z.enum(["economy", "hybrid", "cinematic"]).default("hybrid"),
  publishingMode: z.enum(["manual", "scheduled", "automatic"]).default("manual"),
  duration: z.number().int().min(10).max(3600).default(45),
  slides: z.union([z.literal(5), z.literal(7), z.literal(10)]).default(5),
  seedContents: z.array(contentSchema).default([]),
});
export type CampaignInput = z.infer<typeof campaignSchema>;
export type ResearchSource = {
  title: string;
  url: string;
  publishedAt: string | null;
  observedAt: string;
  evidence: string;
};
export type FactoryAsset = {
  kind: "image" | "voice" | "video" | "subtitle";
  bucket: string;
  path: string;
  mime: string;
  bytes: number;
  checksum: string;
  duration: number | null;
};
export type FactoryTask = {
  id: string;
  campaign_id: string;
  user_id: string;
  ordinal: number;
  stage: string;
  state: string;
  attempt: number;
  lease_owner: string | null;
  lease_until: string | null;
  output: unknown;
  error: string | null;
  updated_at: string;
};
export type FactoryCampaign = {
  id: string;
  user_id: string;
  command: string;
  config: CampaignInput;
  state: string;
  created_at: string;
  tasks: FactoryTask[];
};
export type TaskOutput = {
  content?: BankContent;
  sources?: ResearchSource[];
  assets?: FactoryAsset[];
  qc?: { passed: boolean; issues: string[] };
};
export type FactoryBankRow = {
  id: string;
  user_id: string;
  content_number: number;
  document: BankContent;
  revision: number;
  created_at: string;
  updated_at: string;
};
export const workerInput = z.object({
  action: z.enum(["claim", "complete", "fail"]),
  worker: z.string().min(8).max(100),
  taskId: z.string().uuid().optional(),
  error: z.string().max(1000).optional(),
  assets: z
    .array(
      z.object({
        kind: z.enum(["voice", "video", "subtitle"]),
        path: z.string(),
        mime: z.string(),
        bytes: z.number().int().positive(),
        checksum: z.string().regex(/^[a-f0-9]{64}$/),
        duration: z.number().positive().nullable(),
      }),
    )
    .max(5)
    .optional(),
});
export type WorkerInput = z.infer<typeof workerInput>;

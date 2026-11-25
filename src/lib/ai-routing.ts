export const AI_CAPABILITIES = [
  "CONTENT_STRATEGY", "VIRAL_ANALYSIS", "VIDEO_UNDERSTANDING", "SCRIPT_GENERATION",
  "STORYBOARD", "IMAGE_PROMPT", "CAROUSEL", "QUALITY_JUDGE", "CONTENT_REMIX", "BRAND_KNOWLEDGE",
] as const;
export type AiCapability = (typeof AI_CAPABILITIES)[number];
export const ROUTER_MODELS = ["openai/gpt-6-astra", "openai/gpt-5.4-mini", "anthropic/claude-haiku-4-5"] as const;
export type RouterModel = (typeof ROUTER_MODELS)[number];
export const DEFAULT_ROUTES: Record<AiCapability, RouterModel> = {
  CONTENT_STRATEGY: "openai/gpt-6-astra",
  VIRAL_ANALYSIS: "openai/gpt-6-astra",
  VIDEO_UNDERSTANDING: "openai/gpt-6-astra", // Actual input is sampled frames, not raw video.
  SCRIPT_GENERATION: "openai/gpt-5.4-mini",
  STORYBOARD: "openai/gpt-5.4-mini",
  IMAGE_PROMPT: "openai/gpt-5.4-mini",
  CAROUSEL: "openai/gpt-5.4-mini",
  QUALITY_JUDGE: "openai/gpt-6-astra",
  CONTENT_REMIX: "openai/gpt-5.4-mini",
  BRAND_KNOWLEDGE: "openai/gpt-6-astra",
};
export function selectModel(capability: AiCapability, override?: string): RouterModel {
  if (!override) return DEFAULT_ROUTES[capability];
  const model = ROUTER_MODELS.find((value) => value === override);
  if (!model) throw new Error(`Unsupported model override for ${capability}`);
  return model;
}
export type AiFailure = { code: string; outcome: string; httpStatus?: number };
export function mayFallback(error: AiFailure): boolean {
  // Never replay ambiguous/billed operations, denials, rate limits, or credit failures.
  return error.outcome === "not_started" && error.code === "request_rejected" &&
    (error.httpStatus === 404 || error.httpStatus === 503);
}
import { z } from "zod";
const tokenPricing = z.object({
  tiers: z.array(z.object({ cost: z.string(), min: z.number() })).optional(),
});
export const routerCatalogModel = z.object({
  id: z.string(),
  owned_by: z.string(),
  supported_surfaces: z.array(z.string()),
  modalities: z.object({ input: z.array(z.string()) }),
  pricing: z
    .object({
      cost_currency: z.string(),
      input: z.object({ text: tokenPricing.optional() }).optional(),
      output: z.object({ text: tokenPricing.optional() }).optional(),
    })
    .optional(),
});
export function estimatedTokenCost(
  model: z.infer<typeof routerCatalogModel>,
  inputTokens: number | null,
  outputTokens: number | null,
) {
  if (model.pricing?.cost_currency !== "credits" || inputTokens === null || outputTokens === null)
    return null;
  const input = model.pricing.input?.text?.tiers?.filter((tier) => tier.min <= inputTokens).at(-1);
  const output = model.pricing.output?.text?.tiers
    ?.filter((tier) => tier.min <= outputTokens)
    .at(-1);
  if (!input || !output) return null;
  return inputTokens * Number(input.cost) + outputTokens * Number(output.cost);
}

import { forkContent, type BankContent } from "./content-bank";
import { routeTaskStructured } from "./ai-router.server";
import type { CampaignInput, ResearchSource } from "./factory-types";
import { campaignScriptRequest, campaignScriptDocument, type GeneratedScript } from "./factory-script-request";
import { prepareProductionContent } from "./factory-plan";
export async function generateCampaignScript(
  input: CampaignInput,
  sources: ResearchSource[],
  ordinal: number,
  taskId: string,
  worker: string,
  feedback: unknown = null,
): Promise<BankContent> {
  const seed = input.seedContents[ordinal - 1];
  if (seed?.production.category === "Trending")
    throw new Error("Bukti tren platform belum tersedia.");
  if (
    seed?.production.script.trim() &&
    seed.production.voiceOver.trim() &&
    seed.production.scenes.trim()
  )
    return prepareProductionContent(forkContent(seed, 100000 + ordinal));
  const generated = await routeTaskStructured<GeneratedScript>(
    campaignScriptRequest(input, sources, ordinal, feedback),
    taskId,
    worker,
  );
  return campaignScriptDocument(input, generated.result, ordinal, crypto.randomUUID());
}

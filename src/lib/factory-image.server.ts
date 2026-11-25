import { generateImage, GatewayError } from "@lovable.dev/ai-gateway";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { phase0Client } from "./phase0-db";
import { factoryClient } from "./factory-db";
import type { BankContent } from "./content-bank";
import type { FactoryAsset, FactoryTask } from "./factory-types";

export async function generateCampaignImages(
  admin: SupabaseClient<Database>,
  task: FactoryTask,
  content: BankContent,
  slides: number,
): Promise<FactoryAsset[]> {
  const usage = phase0Client(admin);
  const results: FactoryAsset[] = [];
  for (let index = 0; index < slides; index++) {
    const runId = crypto.randomUUID();
    const { error: recordError } = await usage.from("ai_usage_events").insert({
      id: runId,
      user_id: task.user_id,
      capability: "FACTORY_IMAGE",
      model: "openai/gpt-image-2.5-sunburst",
      provider: "openai",
      state: "started",
    });
    if (recordError) throw new Error("Usage tracking unavailable; image request not sent.");
    try {
      const result = await generateImage(
        {
          model: "openai/gpt-image-2.5-sunburst",
          output_format: "png",
          size: "1024x1536",
          prompt: `${content.prompt}\nCarousel KERJAKU, slide ${index + 1}/${slides}. Variasi visual mengikuti scene: ${content.production.scenes}. Kontinuitas visual sama antar-slide. Teks jelas Bahasa Indonesia, bukan placeholder. Untuk slide ini tekankan ${index === 0 ? content.production.hook : index === slides - 1 ? content.production.cta : content.production.visualDirection}.`,
        },
        { runId },
      );
      const encoded = result.data?.[0]?.b64_json;
      if (!encoded) throw new Error("IMAGE_OUTPUT_MISSING");
      const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
      const checksum = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("");
      const path = `${task.user_id}/factory/${task.campaign_id}/${task.id}/slide-${index + 1}.png`;
      const { error } = await admin.storage
        .from("instagram-media")
        .upload(path, bytes, { upsert: true, contentType: "image/png" });
      if (error) throw new Error("IMAGE_STORAGE_FAILED");
      const asset: FactoryAsset = {
        kind: "image",
        bucket: "instagram-media",
        path,
        bytes: bytes.length,
        checksum,
        mime: "image/png",
        duration: null,
      };
      const { error: mediaError } = await factoryClient(admin)
        .from("craft_media")
        .upsert(
          { ...asset, user_id: task.user_id, task_id: task.id, campaign_id: task.campaign_id },
          { onConflict: "bucket,path" },
        );
      if (mediaError) throw new Error("IMAGE_LIBRARY_WRITE_FAILED");
      results.push(asset);
      const { error: usageError } = await usage
        .from("ai_usage_events")
        .update({
          state: "completed",
          input_tokens: result.usage?.input_tokens ?? null,
          output_tokens: result.usage?.output_tokens ?? null,
        })
        .eq("id", runId);
      if (usageError) throw new Error("IMAGE_USAGE_WRITE_FAILED");
    } catch (error) {
      await usage
        .from("ai_usage_events")
        .update({
          state:
            error instanceof GatewayError && error.outcome === "unknown" ? "unknown" : "failed",
          error_code:
            error instanceof GatewayError ? error.code : "image_storage_or_contract_error",
        })
        .eq("id", runId);
      throw error; // Stored partial slides remain; unknown/billed generations are never replayed.
    }
  }
  return results;
}

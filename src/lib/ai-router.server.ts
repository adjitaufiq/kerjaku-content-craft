import Ajv from "ajv";
import { GatewayError, listModels, streamResponse, generateMessage } from "@lovable.dev/ai-gateway";
import { getRequestHeader } from "@tanstack/react-start/server";
import { mayFallback, selectModel, type AiCapability, type RouterModel } from "./ai-routing";
import { phase0Client } from "./phase0-db";

export type StructuredInput = {
  capability: AiCapability; instructions: string; prompt?: string;
  content?: Array<{ type: "input_text"; text: string } | { type: "input_image"; image_url: string; detail: "auto" }>;
  name: string; schema: Record<string, unknown>;
};
export async function routeStructured<T>(input: StructuredInput): Promise<{ result: T; model: string }> {
  const bearer = getRequestHeader("authorization")?.replace(/^Bearer /, "");
  if (!bearer) throw new Error("Unauthorized");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(bearer);
  if (authError || !auth.user) throw new Error("Unauthorized");
  const db = phase0Client(supabaseAdmin);
  const { data: health, error: healthError } = await db.from("craft_runtime_health").select("ai_paused_until, ai_pause_reason").eq("id", "default").single();
  if (healthError) throw new Error("AI router belum siap: migrasi/koneksi database diperlukan.");
  if (health.ai_pause_reason && (!health.ai_paused_until || Date.parse(health.ai_paused_until) > Date.now())) throw new Error("Produksi AI dijeda; periksa status sistem.");
  const catalog = await listModels();
  if (catalog.workspace_models !== "included") throw new Error("Ketersediaan model workspace belum terverifikasi.");
  const preferred = selectModel(input.capability, process.env[`CRAFT_AI_${input.capability}_MODEL`]);
  const fallback = selectModel(input.capability, process.env["CRAFT_AI_FALLBACK_MODEL"] ?? "anthropic/claude-haiku-4-5");
  const validate = new Ajv({ strict: false }).compile<T>(input.schema);
  const run = async (model: RouterModel) => {
    const listed = catalog.data.find((item) => item.id === model);
    const surface = model.startsWith("anthropic/") ? "messages" : "responses";
    if (!listed?.supported_surfaces.includes(surface) || (input.content?.some((p) => p.type === "input_image") && !listed.modalities.input.includes("image"))) throw new Error("Model tidak mendukung input/surface yang dibutuhkan.");
    const id = crypto.randomUUID();
    const { error: recordError } = await db.from("ai_usage_events").insert({ id, user_id: auth.user.id, capability: input.capability, model, provider: listed.owned_by, state: "started" });
    if (recordError) throw new Error("Pencatatan penggunaan AI gagal; permintaan belum dikirim.");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);
    let output = "";
    let inputTokens: number | null = null;
    let outputTokens: number | null = null;
    try {
      if (model === "anthropic/claude-haiku-4-5") {
        const content = input.content?.map((part) => {
          if (part.type === "input_text") return { type: "text" as const, text: part.text };
          const data = /^data:(image\/[^;]+);base64,(.+)$/.exec(part.image_url);
          if (!data?.[1] || !data[2]) throw new Error("Fallback gambar hanya mendukung frame data URL.");
          const mime = data[1];
          if (mime !== "image/jpeg" && mime !== "image/png" && mime !== "image/gif" && mime !== "image/webp") throw new Error("Format frame tidak didukung.");
          return { type: "image" as const, source: { type: "base64" as const, media_type: mime, data: data[2] } };
        }) ?? [{ type: "text" as const, text: input.prompt ?? "" }];
        const response = await generateMessage({ model: "anthropic/claude-haiku-4-5", max_tokens: 16000, system: `${input.instructions}\nReturn JSON only matching this schema: ${JSON.stringify(input.schema)}`, messages: [{ role: "user", content }] }, { signal: controller.signal, runId: id });
        output = response.content.filter((part) => part.type === "text").map((part) => part.text).join("");
        inputTokens = response.usage.input_tokens;
        outputTokens = response.usage.output_tokens;
      } else {
        const payload = { instructions: input.instructions, input: [{ role: "user" as const, content: input.content ?? [{ type: "input_text" as const, text: input.prompt ?? "" }] }], text: { format: { type: "json_schema" as const, name: input.name, strict: true, schema: input.schema } } };
        const stream = model === "openai/gpt-5.4-mini"
          ? await streamResponse({ ...payload, model: "openai/gpt-5.4-mini", reasoning: { effort: "low" } }, { signal: controller.signal, runId: id })
          : await streamResponse({ ...payload, model: "openai/gpt-6-astra", reasoning: { effort: "medium", summary: "auto" } }, { signal: controller.signal, runId: id });
        for await (const event of stream) {
          if (event.type === "response.output_text.delta") output += event.delta;
          if (event.type === "response.refusal.delta") throw new Error("AI_REFUSAL");
          if (event.type === "response.completed") {
            inputTokens = event.response.usage?.input_tokens ?? null;
            outputTokens = event.response.usage?.output_tokens ?? null;
          }
        }
      }
      const parsed: unknown = JSON.parse(output);
      if (!validate(parsed)) throw new Error("INVALID_STRUCTURED_OUTPUT");
      const inRate = Number(listed.pricing?.input?.text?.tiers?.[0]?.cost);
      const outRate = Number(listed.pricing?.output?.text?.tiers?.[0]?.cost);
      const estimated = inputTokens !== null && outputTokens !== null && Number.isFinite(inRate) && Number.isFinite(outRate) ? inputTokens * inRate + outputTokens * outRate : null;
      const { error } = await db.from("ai_usage_events").update({ state: "completed", input_tokens: inputTokens, output_tokens: outputTokens, estimated_cost_credits: estimated }).eq("id", id);
      if (error) throw new Error("AI_USAGE_PERSIST_FAILED");
      return { result: parsed, model };
    } catch (error) {
      const code = error instanceof GatewayError ? error.code : "application_error";
      await db.from("ai_usage_events").update({ state: error instanceof GatewayError && error.outcome === "unknown" ? "unknown" : "failed", error_code: code }).eq("id", id);
      if (error instanceof GatewayError && ["rate_limited", "payment_required", "permission_denied"].includes(error.code)) {
        await db.from("craft_runtime_health").update({ ai_pause_reason: code, ai_paused_until: error.code === "rate_limited" ? new Date(Date.now() + Math.max(60, error.retryAfter ?? 60) * 1000).toISOString() : null }).eq("id", "default");
      }
      console.error(JSON.stringify({ event: "ai_failure", run_id: id, capability: input.capability, model, code }));
      throw error;
    } finally { clearTimeout(timer); }
  };
  try { return await run(preferred); }
  catch (error) {
    if (error instanceof GatewayError && mayFallback(error) && fallback !== preferred) return run(fallback);
    throw new Error(error instanceof GatewayError ? `AI ${error.code}; periksa status sistem sebelum mencoba ulang.` : "AI tidak dapat menyelesaikan permintaan; hasil dan biaya perlu diperiksa.");
  }
}
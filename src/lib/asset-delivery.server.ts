import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { parseAssetReference } from "./asset-reference";

export async function refreshAssetUrls(
  client: SupabaseClient<Database>,
  references: string[],
  ttlSeconds = 3600,
) {
  const origin = process.env["VITE_SUPABASE_URL"];
  if (!origin) throw new Error("Alamat penyimpanan belum dikonfigurasi.");
  return Promise.all(
    references.map(async (reference) => {
      const path = parseAssetReference(reference, origin, "instagram-media");
      // Use the caller-scoped client: a fresh URL can only be issued for readable owned assets.
      const { data, error } = await client.storage
        .from("instagram-media")
        .createSignedUrl(path, ttlSeconds);
      if (error || !data?.signedUrl) throw new Error("Aset tidak tersedia atau akses ditolak.");
      // Sandbox-local server URLs cannot be delivered to a browser or Meta.
      const signed = new URL(data.signedUrl);
      const publicOrigin = new URL(origin);
      return `${publicOrigin.origin}${signed.pathname}${signed.search}`;
    }),
  );
}
